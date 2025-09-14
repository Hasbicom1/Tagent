import { logSecurityEvent } from './security';

// Advanced ML-based fraud detection (complement to existing calculateRiskScore)
export interface FraudSignals {
  // Payment patterns
  amountAnomaly: number;
  frequencyAnomaly: number;
  timingAnomaly: number;
  
  // Geographic signals
  countryRisk: number;
  vpnDetected: boolean;
  ipReputation: number;
  
  // Behavioral signals
  deviceFingerprint: string;
  browserAnomaly: number;
  sessionBehavior: number;
  
  // Network signals
  asn: string;
  datacenterDetected: boolean;
  torDetected: boolean;
}

export interface MLFraudResult {
  riskScore: number;
  confidence: number;
  primarySignals: string[];
  recommendation: 'approve' | 'review' | 'decline';
  explainability: Record<string, number>;
}

// ML-based risk model (simplified logistic regression approach)
export class MLFraudDetector {
  private weights = {
    // Payment pattern weights
    amountAnomaly: 0.25,
    frequencyAnomaly: 0.20,
    timingAnomaly: 0.15,
    
    // Geographic weights
    countryRisk: 0.30,
    vpnDetected: 0.15,
    ipReputation: 0.25,
    
    // Behavioral weights
    browserAnomaly: 0.10,
    sessionBehavior: 0.15,
    
    // Network weights
    datacenterDetected: 0.20,
    torDetected: 0.35
  };
  
  private thresholds = {
    approve: 0.3,
    review: 0.7,
    decline: 0.9
  };

  async detectFraud(paymentIntent: any, signals: FraudSignals): Promise<MLFraudResult> {
    const features = this.extractFeatures(paymentIntent, signals);
    const riskScore = this.calculateMLRiskScore(features);
    const confidence = this.calculateConfidence(features);
    const primarySignals = this.identifyPrimarySignals(features);
    
    const result: MLFraudResult = {
      riskScore,
      confidence,
      primarySignals,
      recommendation: this.getRecommendation(riskScore),
      explainability: this.generateExplanation(features)
    };
    
    // Log high-risk cases
    if (riskScore > this.thresholds.review) {
      await logSecurityEvent('payment_fraud', {
        paymentIntentId: paymentIntent.id,
        mlRiskScore: riskScore,
        confidence,
        recommendation: result.recommendation,
        primarySignals,
        amount: paymentIntent.amount,
        clientIP: signals.deviceFingerprint
      });
    }
    
    return result;
  }
  
  private extractFeatures(paymentIntent: any, signals: FraudSignals): Record<string, number> {
    const amount = paymentIntent.amount / 100;
    
    return {
      // Amount features
      amountAnomaly: this.normalizeAmount(amount),
      frequencyAnomaly: signals.frequencyAnomaly,
      timingAnomaly: signals.timingAnomaly,
      
      // Geographic features
      countryRisk: signals.countryRisk,
      vpnDetected: signals.vpnDetected ? 1 : 0,
      ipReputation: 1 - signals.ipReputation, // Invert (lower rep = higher risk)
      
      // Behavioral features
      browserAnomaly: signals.browserAnomaly,
      sessionBehavior: signals.sessionBehavior,
      
      // Network features
      datacenterDetected: signals.datacenterDetected ? 1 : 0,
      torDetected: signals.torDetected ? 1 : 0
    };
  }
  
  private calculateMLRiskScore(features: Record<string, number>): number {
    let score = 0;
    let totalWeight = 0;
    
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.weights[feature as keyof typeof this.weights] || 0;
      score += value * weight;
      totalWeight += weight;
    }
    
    // Normalize to 0-1 scale
    return Math.min(Math.max(score / totalWeight, 0), 1);
  }
  
  private calculateConfidence(features: Record<string, number>): number {
    // Confidence based on signal strength and consistency
    const signalStrength = Object.values(features).reduce((sum, val) => sum + Math.abs(val), 0);
    const signalCount = Object.values(features).filter(val => val > 0.1).length;
    
    return Math.min(signalStrength / signalCount, 1);
  }
  
  private identifyPrimarySignals(features: Record<string, number>): string[] {
    return Object.entries(features)
      .filter(([_, value]) => value > 0.5)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([signal]) => signal);
  }
  
  private getRecommendation(riskScore: number): 'approve' | 'review' | 'decline' {
    if (riskScore < this.thresholds.approve) return 'approve';
    if (riskScore < this.thresholds.review) return 'review';
    return 'decline';
  }
  
  private generateExplanation(features: Record<string, number>): Record<string, number> {
    const explanation: Record<string, number> = {};
    
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.weights[feature as keyof typeof this.weights] || 0;
      explanation[feature] = value * weight;
    }
    
    return explanation;
  }
  
  private normalizeAmount(amount: number): number {
    // For $1 platform, any amount != $1 is suspicious
    if (amount === 1) return 0;
    if (amount < 1) return 0.8; // Too low
    if (amount > 10) return 0.6; // Too high
    return Math.abs(amount - 1) / 10; // Distance from expected $1
  }
}

// Signal collection helpers
export class FraudSignalCollector {
  async collectSignals(req: any, paymentIntent: any): Promise<FraudSignals> {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    return {
      // Payment patterns (would be enhanced with historical data)
      amountAnomaly: this.calculateAmountAnomaly(paymentIntent.amount),
      frequencyAnomaly: await this.calculateFrequencyAnomaly(clientIP),
      timingAnomaly: this.calculateTimingAnomaly(),
      
      // Geographic signals
      countryRisk: await this.getCountryRisk(clientIP),
      vpnDetected: await this.detectVPN(clientIP),
      ipReputation: await this.getIPReputation(clientIP),
      
      // Behavioral signals
      deviceFingerprint: this.generateDeviceFingerprint(req),
      browserAnomaly: this.calculateBrowserAnomaly(req.headers['user-agent']),
      sessionBehavior: 0.1, // Placeholder - would analyze session patterns
      
      // Network signals
      asn: await this.getASN(clientIP),
      datacenterDetected: await this.detectDatacenter(clientIP),
      torDetected: await this.detectTor(clientIP)
    };
  }
  
  private calculateAmountAnomaly(amount: number): number {
    const expectedAmount = 100; // $1 in cents
    return Math.abs(amount - expectedAmount) / expectedAmount;
  }
  
  private async calculateFrequencyAnomaly(ip: string): Promise<number> {
    // In production, this would check Redis for recent payment frequency
    // For now, return low risk
    return 0.1;
  }
  
  private calculateTimingAnomaly(): number {
    const hour = new Date().getHours();
    // Higher risk during unusual hours (2-6 AM UTC)
    if (hour >= 2 && hour <= 6) return 0.3;
    return 0.1;
  }
  
  private async getCountryRisk(ip: string): Promise<number> {
    // Simplified country risk scoring
    const highRiskCountries = ['CN', 'RU', 'NG', 'PK', 'BD'];
    const mediumRiskCountries = ['IN', 'ID', 'VN'];
    
    try {
      // In production, use actual IP geolocation
      // For demo, simulate based on IP patterns
      if (ip.startsWith('192.168.') || ip.startsWith('127.')) {
        return 0.1; // Local/development
      }
      
      // Simplified risk assignment
      const hash = this.simpleHash(ip) % 100;
      if (hash < 5) return 0.8; // High risk
      if (hash < 15) return 0.4; // Medium risk
      return 0.1; // Low risk
      
    } catch (error) {
      return 0.2; // Default medium-low risk
    }
  }
  
  private async detectVPN(ip: string): Promise<boolean> {
    // In production, use VPN detection service
    // For demo, simulate detection
    return this.simpleHash(ip) % 20 === 0;
  }
  
  private async getIPReputation(ip: string): Promise<number> {
    // In production, use IP reputation service
    // For demo, simulate reputation score (0-1, higher = better)
    if (ip.startsWith('192.168.') || ip.startsWith('127.')) {
      return 0.9; // Local IPs are safe
    }
    return 0.7 + (this.simpleHash(ip) % 30) / 100;
  }
  
  private generateDeviceFingerprint(req: any): string {
    const ua = req.headers['user-agent'] || '';
    const accept = req.headers['accept'] || '';
    const lang = req.headers['accept-language'] || '';
    
    return this.simpleHash(ua + accept + lang).toString();
  }
  
  private calculateBrowserAnomaly(userAgent: string): number {
    if (!userAgent) return 0.5;
    
    // Check for suspicious patterns
    const suspicious = [
      'curl', 'wget', 'python', 'bot', 'crawler',
      'headless', 'phantom', 'selenium'
    ];
    
    for (const pattern of suspicious) {
      if (userAgent.toLowerCase().includes(pattern)) {
        return 0.8;
      }
    }
    
    return 0.1;
  }
  
  private async getASN(ip: string): Promise<string> {
    // In production, use ASN lookup service
    return `AS${this.simpleHash(ip) % 100000}`;
  }
  
  private async detectDatacenter(ip: string): Promise<boolean> {
    // In production, check against datacenter IP ranges
    return this.simpleHash(ip) % 15 === 0;
  }
  
  private async detectTor(ip: string): Promise<boolean> {
    // In production, check against Tor exit node list
    return this.simpleHash(ip) % 100 === 0;
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instances
export const mlFraudDetector = new MLFraudDetector();
export const fraudSignalCollector = new FraudSignalCollector();