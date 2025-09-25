#!/bin/bash

# Automated CI/CD Security Scanning Script
# Produces JSON reports suitable for CI/CD pipelines

set -e

# Configuration
SCAN_TYPE=${1:-"full"}  # full, quick, dependencies, secrets
OUTPUT_DIR=${2:-"security-reports"}
CI_MODE=${3:-false}

echo "🔒 Automated Security Scanning"
echo "=============================="
echo "Scan type: $SCAN_TYPE"
echo "Output directory: $OUTPUT_DIR"
echo "CI mode: $CI_MODE"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/security-scan-$TIMESTAMP.json"

# Initialize report structure
cat > "$REPORT_FILE" << 'EOF'
{
  "scan_metadata": {
    "timestamp": "",
    "scan_type": "",
    "scanner_version": "1.0.0",
    "project_name": "agent-hq",
    "scan_duration_ms": 0
  },
  "summary": {
    "total_issues": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  },
  "scans": {
    "dependencies": {
      "enabled": false,
      "issues": [],
      "summary": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    },
    "secrets": {
      "enabled": false,
      "issues": [],
      "summary": {"total": 0, "patterns_checked": 0}
    },
    "code_analysis": {
      "enabled": false,
      "issues": [],
      "summary": {"total": 0, "files_scanned": 0}
    },
    "configuration": {
      "enabled": false,
      "issues": [],
      "summary": {"total": 0, "checks_performed": 0}
    }
  },
  "recommendations": [],
  "exit_code": 0
}
EOF

SCAN_START=$(date +%s%3N)

echo "🔍 Starting security scan..."

# Update scan metadata
python3 -c "
import json
import sys
from datetime import datetime

with open('$REPORT_FILE', 'r') as f:
    report = json.load(f)

report['scan_metadata']['timestamp'] = datetime.now().isoformat()
report['scan_metadata']['scan_type'] = '$SCAN_TYPE'

with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2)
"

# Function to update report section
update_report() {
    local section=$1
    local data=$2
    python3 -c "
import json
import sys

with open('$REPORT_FILE', 'r') as f:
    report = json.load(f)

section_data = json.loads('''$data''')
report['scans']['$section'] = section_data
report['scans']['$section']['enabled'] = True

# Update summary
total = sum(scan['summary'].get('total', 0) for scan in report['scans'].values() if scan.get('enabled', False))
report['summary']['total_issues'] = total

with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2)
"
}

# 1. DEPENDENCY VULNERABILITY SCANNING
if [[ "$SCAN_TYPE" == "full" ]] || [[ "$SCAN_TYPE" == "quick" ]] || [[ "$SCAN_TYPE" == "dependencies" ]]; then
    echo "📦 Scanning dependencies for vulnerabilities..."
    
    # Run npm audit and capture output
    if npm audit --json > "$OUTPUT_DIR/npm-audit.json" 2>/dev/null || true; then
        echo "✅ NPM audit completed"
        
        # Parse npm audit results
        DEP_SCAN_RESULT=$(python3 -c "
import json
import sys

try:
    with open('$OUTPUT_DIR/npm-audit.json', 'r') as f:
        audit_data = json.load(f)
    
    issues = []
    
    if 'vulnerabilities' in audit_data:
        for pkg, vuln in audit_data.get('vulnerabilities', {}).items():
            severity = vuln.get('severity', 'unknown')
            
            issue = {
                'type': 'dependency_vulnerability',
                'severity': severity,
                'package': pkg,
                'title': vuln.get('title', 'Vulnerability in ' + pkg),
                'description': vuln.get('url', ''),
                'affected_versions': vuln.get('range', 'unknown'),
                'patched_versions': vuln.get('fixAvailable', {}).get('version', 'none') if vuln.get('fixAvailable') else 'none',
                'cwe': vuln.get('cwe', []),
                'cvss': vuln.get('cvss', {})
            }
            issues.append(issue)
    
    # Count by severity
    counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    for issue in issues:
        sev = issue['severity'].lower()
        if sev in counts:
            counts[sev] += 1
    
    result = {
        'issues': issues,
        'summary': {
            'total': len(issues),
            'critical': counts['critical'],
            'high': counts['high'],
            'medium': counts['medium'],
            'low': counts['low']
        }
    }
    
    print(json.dumps(result))
    
except Exception as e:
    result = {
        'issues': [{'type': 'scan_error', 'severity': 'medium', 'title': 'Dependency scan failed', 'description': str(e)}],
        'summary': {'total': 1, 'critical': 0, 'high': 0, 'medium': 1, 'low': 0}
    }
    print(json.dumps(result))
")
        
        update_report "dependencies" "$DEP_SCAN_RESULT"
    else
        echo "⚠️  NPM audit failed, skipping dependency scan"
    fi
else
    echo "⏭️  Skipping dependency scan"
fi

# 2. SECRET DETECTION SCANNING
if [[ "$SCAN_TYPE" == "full" ]] || [[ "$SCAN_TYPE" == "secrets" ]]; then
    echo "🔐 Scanning for exposed secrets..."
    
    # Simple regex-based secret detection
    SECRET_PATTERNS=(
        "password\s*=\s*['\"][^'\"]*['\"]"
        "api_key\s*=\s*['\"][^'\"]*['\"]"
        "secret\s*=\s*['\"][^'\"]*['\"]"
        "token\s*=\s*['\"][^'\"]*['\"]"
        "AKIA[0-9A-Z]{16}"  # AWS Access Key
        "sk_live_[0-9a-zA-Z]{24,}"  # Stripe Live Secret
        "sk_test_[0-9a-zA-Z]{24,}"  # Stripe Test Secret
        "xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}"  # Slack Bot Token
        "ghp_[a-zA-Z0-9]{36}"  # GitHub Personal Access Token
    )
    
    SECRET_SCAN_RESULT=$(python3 -c "
import re
import os
import json

issues = []
patterns_checked = len(${#SECRET_PATTERNS[@]})
files_scanned = 0

# Directories to scan
scan_dirs = ['server', 'client/src', 'scripts', 'shared']
exclude_patterns = ['.git', 'node_modules', 'dist', '.env.example']

patterns = [
    r'password\s*=\s*[\'\"]\w+[\'\"]',
    r'api_key\s*=\s*[\'\"]\w+[\'\"]',
    r'secret\s*=\s*[\'\"]\w+[\'\"]',
    r'token\s*=\s*[\'\"]\w+[\'\"]',
    r'AKIA[0-9A-Z]{16}',
    r'sk_live_[0-9a-zA-Z]{24,}',
    r'sk_test_[0-9a-zA-Z]{24,}',
    r'xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}',
    r'ghp_[a-zA-Z0-9]{36}'
]

def should_exclude(path):
    return any(exc in path for exc in exclude_patterns)

def scan_file(filepath):
    global files_scanned
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            files_scanned += 1
            
            for i, pattern in enumerate(patterns):
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    # Skip .env.example files and commented lines
                    if '.env.example' in filepath or match.group().strip().startswith('#'):
                        continue
                        
                    line_num = content[:match.start()].count('\n') + 1
                    issue = {
                        'type': 'potential_secret',
                        'severity': 'high' if 'live' in match.group() else 'medium',
                        'file': filepath,
                        'line': line_num,
                        'pattern_matched': f'Pattern {i+1}',
                        'title': f'Potential secret detected in {filepath}',
                        'description': f'Line {line_num}: Pattern suggests exposed secret'
                    }
                    issues.append(issue)
    except Exception:
        pass  # Skip files that can't be read

# Scan directories
for scan_dir in scan_dirs:
    if os.path.exists(scan_dir):
        for root, dirs, files in os.walk(scan_dir):
            if should_exclude(root):
                continue
                
            for file in files:
                if file.endswith(('.js', '.ts', '.json', '.env', '.yaml', '.yml', '.sh')):
                    filepath = os.path.join(root, file)
                    if not should_exclude(filepath):
                        scan_file(filepath)

result = {
    'issues': issues,
    'summary': {
        'total': len(issues),
        'patterns_checked': patterns_checked,
        'files_scanned': files_scanned
    }
}

print(json.dumps(result))
")
    
    update_report "secrets" "$SECRET_SCAN_RESULT"
    echo "✅ Secret detection scan completed"
else
    echo "⏭️  Skipping secret detection"
fi

# 3. CODE ANALYSIS (BASIC STATIC ANALYSIS)
if [[ "$SCAN_TYPE" == "full" ]]; then
    echo "🔍 Running static code analysis..."
    
    CODE_SCAN_RESULT=$(python3 -c "
import os
import json
import re

issues = []
files_scanned = 0

# Security anti-patterns to detect
patterns = [
    (r'eval\s*\(', 'critical', 'Use of eval() detected - potential code injection'),
    (r'innerHTML\s*=', 'medium', 'Use of innerHTML - potential XSS vulnerability'),
    (r'document\.write\s*\(', 'medium', 'Use of document.write() - potential XSS vulnerability'),
    (r'SQL.*\+.*[\'\"]\w+[\'\"]', 'high', 'Potential SQL injection - string concatenation in query'),
    (r'exec\s*\(', 'high', 'Use of exec() - potential command injection'),
    (r'shell\s*=\s*True', 'high', 'Shell execution enabled - potential command injection'),
    (r'process\.env\.[A-Z_]+\s*\|\|.*[\'\"]\w+[\'\"]', 'low', 'Hardcoded fallback for environment variable'),
    (r'console\.log\s*\(.*password.*\)', 'medium', 'Password potentially logged to console'),
    (r'Math\.random\s*\(\)', 'low', 'Use of Math.random() for security purposes - use crypto.randomBytes()'),
    (r'setTimeout\s*\(\s*[\'\"]\w+', 'medium', 'setTimeout with string argument - potential code injection')
]

def scan_file(filepath):
    global files_scanned
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            files_scanned += 1
            
            for pattern, severity, description in patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    line_num = content[:match.start()].count('\n') + 1
                    issue = {
                        'type': 'code_security_issue',
                        'severity': severity,
                        'file': filepath,
                        'line': line_num,
                        'title': f'Security issue in {os.path.basename(filepath)}',
                        'description': description,
                        'matched_text': match.group()[:50] + '...' if len(match.group()) > 50 else match.group()
                    }
                    issues.append(issue)
    except Exception:
        pass

# Scan source files
scan_dirs = ['server', 'client/src', 'shared']
for scan_dir in scan_dirs:
    if os.path.exists(scan_dir):
        for root, dirs, files in os.walk(scan_dir):
            if any(exc in root for exc in ['.git', 'node_modules', 'dist']):
                continue
            for file in files:
                if file.endswith(('.js', '.ts', '.jsx', '.tsx')):
                    scan_file(os.path.join(root, file))

result = {
    'issues': issues,
    'summary': {
        'total': len(issues),
        'files_scanned': files_scanned
    }
}

print(json.dumps(result))
")
    
    update_report "code_analysis" "$CODE_SCAN_RESULT"
    echo "✅ Static code analysis completed"
else
    echo "⏭️  Skipping static code analysis"
fi

# 4. CONFIGURATION SECURITY CHECKS
if [[ "$SCAN_TYPE" == "full" ]] || [[ "$SCAN_TYPE" == "quick" ]]; then
    echo "⚙️  Checking security configuration..."
    
    CONFIG_SCAN_RESULT=$(python3 -c "
import os
import json

issues = []
checks_performed = 0

def check_env_file():
    global checks_performed
    checks_performed += 1
    
    if os.path.exists('.env'):
        issues.append({
            'type': 'configuration_issue',
            'severity': 'high',
            'title': '.env file in repository',
            'description': '.env file should not be committed to version control',
            'file': '.env'
        })
    
    if not os.path.exists('.env.example'):
        issues.append({
            'type': 'configuration_issue',
            'severity': 'medium',
            'title': 'Missing .env.example',
            'description': '.env.example file should be provided for documentation',
            'file': 'root'
        })

def check_package_json():
    global checks_performed
    checks_performed += 1
    
    if os.path.exists('package.json'):
        try:
            with open('package.json', 'r') as f:
                import json
                pkg = json.load(f)
                
                # Check for security-related scripts
                scripts = pkg.get('scripts', {})
                if 'audit' not in scripts:
                    issues.append({
                        'type': 'configuration_issue',
                        'severity': 'low',
                        'title': 'Missing audit script',
                        'description': 'Consider adding npm audit script for security checks',
                        'file': 'package.json'
                    })
                
                # Check for outdated dependencies (simplified check)
                deps = pkg.get('dependencies', {})
                if 'express' in deps:
                    version = deps['express']
                    if version.startswith('^4.1') or version.startswith('4.1'):
                        issues.append({
                            'type': 'configuration_issue',
                            'severity': 'medium',
                            'title': 'Potentially outdated Express version',
                            'description': f'Express version {version} may have security vulnerabilities',
                            'file': 'package.json'
                        })
        except:
            pass

def check_security_headers():
    global checks_performed
    checks_performed += 1
    
    # Check if helmet is configured (look for helmet in server files)
    server_files = []
    if os.path.exists('server'):
        for root, dirs, files in os.walk('server'):
            for file in files:
                if file.endswith('.js') or file.endswith('.ts'):
                    server_files.append(os.path.join(root, file))
    
    helmet_found = False
    for filepath in server_files:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'helmet' in content:
                    helmet_found = True
                    break
        except:
            continue
    
    if not helmet_found:
        issues.append({
            'type': 'configuration_issue',
            'severity': 'high',
            'title': 'Missing security headers middleware',
            'description': 'Consider using helmet or similar middleware for security headers',
            'file': 'server configuration'
        })

def check_https_configuration():
    global checks_performed
    checks_performed += 1
    
    # Look for HTTPS enforcement in configuration
    config_files = ['server/index.ts', 'server/index.js', 'server.js', 'app.js']
    https_enforced = False
    
    for config_file in config_files:
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'https' in content.lower() or 'tls' in content.lower():
                        https_enforced = True
                        break
            except:
                continue
    
    if not https_enforced:
        issues.append({
            'type': 'configuration_issue',
            'severity': 'medium',
            'title': 'HTTPS enforcement not detected',
            'description': 'Ensure HTTPS is enforced in production',
            'file': 'server configuration'
        })

# Run all checks
check_env_file()
check_package_json()
check_security_headers()
check_https_configuration()

result = {
    'issues': issues,
    'summary': {
        'total': len(issues),
        'checks_performed': checks_performed
    }
}

print(json.dumps(result))
")
    
    update_report "configuration" "$CONFIG_SCAN_RESULT"
    echo "✅ Configuration security check completed"
else
    echo "⏭️  Skipping configuration checks"
fi

# Calculate scan duration and update final report
SCAN_END=$(date +%s%3N)
SCAN_DURATION=$((SCAN_END - SCAN_START))

# Generate final report with recommendations
python3 -c "
import json
from datetime import datetime

with open('$REPORT_FILE', 'r') as f:
    report = json.load(f)

# Update scan duration
report['scan_metadata']['scan_duration_ms'] = $SCAN_DURATION

# Calculate summary totals
total_issues = 0
severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}

for scan_name, scan_data in report['scans'].items():
    if scan_data.get('enabled', False):
        scan_summary = scan_data.get('summary', {})
        total_issues += scan_summary.get('total', 0)
        
        for severity in severity_counts.keys():
            severity_counts[severity] += scan_summary.get(severity, 0)

report['summary']['total_issues'] = total_issues
report['summary'].update(severity_counts)

# Generate recommendations based on findings
recommendations = []

if severity_counts['critical'] > 0:
    recommendations.append({
        'priority': 'critical',
        'title': 'Address Critical Security Issues',
        'description': f'{severity_counts[\"critical\"]} critical security issues found. Review and fix immediately.',
        'action': 'Fix critical vulnerabilities before deployment'
    })

if severity_counts['high'] > 0:
    recommendations.append({
        'priority': 'high', 
        'title': 'Fix High-Priority Security Issues',
        'description': f'{severity_counts[\"high\"]} high-priority issues found. Address in next sprint.',
        'action': 'Schedule fixes for high-priority vulnerabilities'
    })

if report['scans']['dependencies']['enabled'] and report['scans']['dependencies']['summary']['total'] > 0:
    recommendations.append({
        'priority': 'medium',
        'title': 'Update Dependencies',
        'description': 'Run npm audit fix to resolve dependency vulnerabilities.',
        'action': 'Execute: npm audit fix'
    })

if report['scans']['secrets']['enabled'] and report['scans']['secrets']['summary']['total'] > 0:
    recommendations.append({
        'priority': 'high',
        'title': 'Remove Exposed Secrets',
        'description': 'Potential secrets detected in code. Review and move to environment variables.',
        'action': 'Review flagged files and use .env files or secret managers'
    })

recommendations.append({
    'priority': 'low',
    'title': 'Regular Security Scanning',
    'description': 'Run security scans regularly in CI/CD pipeline.',
    'action': 'Schedule weekly automated security scans'
})

report['recommendations'] = recommendations

# Set exit code based on severity
exit_code = 0
if severity_counts['critical'] > 0:
    exit_code = 2
elif severity_counts['high'] > 0:
    exit_code = 1

report['exit_code'] = exit_code

with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2)

print(f'Scan completed. Exit code: {exit_code}')
"

echo ""
echo "✅ Security scan completed!"
echo ""

# Display summary
echo "📊 Security Scan Summary:"
python3 -c "
import json

with open('$REPORT_FILE', 'r') as f:
    report = json.load(f)

summary = report['summary']
print(f'  • Total issues: {summary[\"total_issues\"]}')
print(f'  • Critical: {summary[\"critical\"]}')
print(f'  • High: {summary[\"high\"]}')
print(f'  • Medium: {summary[\"medium\"]}')
print(f'  • Low: {summary[\"low\"]}')
print(f'  • Scan duration: {report[\"scan_metadata\"][\"scan_duration_ms\"]}ms')
print('')
print('📋 Top Recommendations:')
for i, rec in enumerate(report['recommendations'][:3]):
    print(f'  {i+1}. [{rec[\"priority\"].upper()}] {rec[\"title\"]}')
    print(f'     {rec[\"description\"]}')
"

echo ""
echo "📁 Full report: $REPORT_FILE"

# Exit with appropriate code for CI/CD
if [[ "$CI_MODE" == "true" ]]; then
    EXIT_CODE=$(python3 -c "
import json
with open('$REPORT_FILE', 'r') as f:
    report = json.load(f)
print(report['exit_code'])
")
    exit $EXIT_CODE
fi

echo ""
echo "🔗 To run security scanning:"
echo "  ./scripts/security-scan.sh full ./security-reports true"