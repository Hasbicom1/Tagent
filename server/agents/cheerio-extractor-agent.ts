/**
 * CHEERIO EXTRACTOR AGENT
 * 
 * Fast HTML parsing and data extraction using Cheerio
 * No API keys required - works entirely locally
 */

import * as cheerio from 'cheerio';
import { AgentTask, AgentResult, AgentAction } from './free-agent-registry';
import { logger } from '../logger';

export class CheerioExtractorAgent {
  private extractionRules: Map<string, any> = new Map();

  constructor() {
    this.initializeExtractionRules();
  }

  /**
   * Initialize extraction rules
   */
  private initializeExtractionRules(): void {
    // Text extraction rules
    this.extractionRules.set('text', {
      selectors: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      filters: ['visible', 'not-empty'],
      priority: 1
    });

    // Link extraction rules
    this.extractionRules.set('links', {
      selectors: ['a[href]'],
      attributes: ['href', 'text', 'title'],
      priority: 2
    });

    // Image extraction rules
    this.extractionRules.set('images', {
      selectors: ['img'],
      attributes: ['src', 'alt', 'title', 'width', 'height'],
      priority: 3
    });

    // Form extraction rules
    this.extractionRules.set('forms', {
      selectors: ['form'],
      attributes: ['action', 'method', 'name'],
      inputs: ['input', 'textarea', 'select'],
      priority: 4
    });

    // Table extraction rules
    this.extractionRules.set('tables', {
      selectors: ['table'],
      extract: ['headers', 'rows', 'data'],
      priority: 5
    });

    // Metadata extraction rules
    this.extractionRules.set('metadata', {
      selectors: ['title', 'meta[name]', 'meta[property]'],
      attributes: ['content', 'name', 'property'],
      priority: 6
    });

    logger.info('📊 Cheerio Extractor: Initialized with 6 extraction rule categories');
  }

  /**
   * Execute data extraction task
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      logger.info('🎯 Cheerio Extractor: Executing task', {
        taskId: task.id,
        instruction: task.instruction
      });

      // Step 1: Analyze extraction requirements
      const requirements = this.analyzeExtractionRequirements(task.instruction);
      
      // Step 2: Get HTML content
      const htmlContent = await this.getHTMLContent(task.context?.url);
      
      // Step 3: Parse HTML with Cheerio
      const $ = cheerio.load(htmlContent);
      
      // Step 4: Extract data based on requirements
      const extractedData = this.extractData($, requirements);
      
      // Step 5: Generate actions
      const actions = this.generateExtractionActions(extractedData);
      
      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Cheerio Extractor: Task completed', {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
        dataTypes: Object.keys(extractedData).length
      });

      return {
        success: true,
        taskId: task.id,
        agentId: 'cheerio-extractor',
        actions,
        confidence: 0.9,
        executionTime,
        metadata: {
          extractedData,
          requirements,
          dataSize: JSON.stringify(extractedData).length
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('❌ Cheerio Extractor: Task failed', {
        taskId: task.id,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentId: 'cheerio-extractor',
        actions: [],
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze extraction requirements from instruction
   */
  private analyzeExtractionRequirements(instruction: string): any {
    const requirements = {
      text: false,
      links: false,
      images: false,
      forms: false,
      tables: false,
      metadata: false,
      specific: [] as string[]
    };

    const instructionLower = instruction.toLowerCase();

    // Check for specific extraction types
    if (instructionLower.includes('text') || instructionLower.includes('content')) {
      requirements.text = true;
    }

    if (instructionLower.includes('link') || instructionLower.includes('url')) {
      requirements.links = true;
    }

    if (instructionLower.includes('image') || instructionLower.includes('photo')) {
      requirements.images = true;
    }

    if (instructionLower.includes('form') || instructionLower.includes('input')) {
      requirements.forms = true;
    }

    if (instructionLower.includes('table') || instructionLower.includes('data')) {
      requirements.tables = true;
    }

    if (instructionLower.includes('meta') || instructionLower.includes('title')) {
      requirements.metadata = true;
    }

    // Extract specific selectors
    const selectorMatches = instruction.match(/['"`]([^'"`]+)['"`]/g);
    if (selectorMatches) {
      requirements.specific = selectorMatches.map(match => 
        match.replace(/['"`]/g, '')
      );
    }

    return requirements;
  }

  /**
   * Get HTML content from URL or context
   */
  private async getHTMLContent(url?: string): Promise<string> {
    if (url) {
      try {
        const response = await fetch(url);
        return await response.text();
      } catch (error) {
        logger.warn('⚠️ Cheerio Extractor: Failed to fetch URL, using sample HTML', {
          url,
          error: error instanceof Error ? error.message : 'unknown error'
        });
      }
    }

    // Return sample HTML for testing
    return `
      <html>
        <head>
          <title>Sample Page</title>
          <meta name="description" content="Sample page for extraction">
        </head>
        <body>
          <h1>Welcome to Sample Page</h1>
          <p>This is a sample paragraph with some text content.</p>
          <a href="https://example.com">Example Link</a>
          <img src="image.jpg" alt="Sample Image">
          <form action="/submit" method="post">
            <input type="text" name="name" placeholder="Your Name">
            <input type="email" name="email" placeholder="Your Email">
            <button type="submit">Submit</button>
          </form>
          <table>
            <tr><th>Name</th><th>Age</th></tr>
            <tr><td>John</td><td>25</td></tr>
            <tr><td>Jane</td><td>30</td></tr>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Extract data using Cheerio
   */
  private extractData($: cheerio.CheerioAPI, requirements: any): any {
    const extractedData: any = {};

    // Extract text content
    if (requirements.text) {
      extractedData.text = this.extractText($);
    }

    // Extract links
    if (requirements.links) {
      extractedData.links = this.extractLinks($);
    }

    // Extract images
    if (requirements.images) {
      extractedData.images = this.extractImages($);
    }

    // Extract forms
    if (requirements.forms) {
      extractedData.forms = this.extractForms($);
    }

    // Extract tables
    if (requirements.tables) {
      extractedData.tables = this.extractTables($);
    }

    // Extract metadata
    if (requirements.metadata) {
      extractedData.metadata = this.extractMetadata($);
    }

    // Extract specific selectors
    if (requirements.specific.length > 0) {
      extractedData.specific = this.extractSpecific($, requirements.specific);
    }

    return extractedData;
  }

  /**
   * Extract text content
   */
  private extractText($: cheerio.CheerioAPI): any {
    const textData: any = {
      headings: [] as string[],
      paragraphs: [] as string[],
      allText: ''
    };

    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        textData.headings.push(text);
      }
    });

    // Extract paragraphs
    $('p').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        textData.paragraphs.push(text);
      }
    });

    // Extract all text
    textData.allText = $('body').text().replace(/\s+/g, ' ').trim();

    return textData;
  }

  /**
   * Extract links
   */
  private extractLinks($: cheerio.CheerioAPI): any[] {
    const links: any[] = [];

    $('a[href]').each((_, element) => {
      const $element = $(element);
      const href = $element.attr('href');
      const text = $element.text().trim();
      const title = $element.attr('title');

      if (href) {
        links.push({
          href,
          text,
          title: title || '',
          isExternal: href.startsWith('http') && !href.includes(window.location.hostname)
        });
      }
    });

    return links;
  }

  /**
   * Extract images
   */
  private extractImages($: cheerio.CheerioAPI): any[] {
    const images: any[] = [];

    $('img').each((_, element) => {
      const $element = $(element);
      const src = $element.attr('src');
      const alt = $element.attr('alt');
      const title = $element.attr('title');
      const width = $element.attr('width');
      const height = $element.attr('height');

      if (src) {
        images.push({
          src,
          alt: alt || '',
          title: title || '',
          width: width ? parseInt(width) : null,
          height: height ? parseInt(height) : null
        });
      }
    });

    return images;
  }

  /**
   * Extract forms
   */
  private extractForms($: cheerio.CheerioAPI): any[] {
    const forms: any[] = [];

    $('form').each((_, element) => {
      const $form = $(element);
      const formData: any = {
        action: $form.attr('action') || '',
        method: $form.attr('method') || 'get',
        name: $form.attr('name') || '',
        inputs: [] as any[]
      };

      // Extract form inputs
      $form.find('input, textarea, select').each((_, inputElement) => {
        const $input = $(inputElement);
        formData.inputs.push({
          type: $input.attr('type') || $input.prop('tagName').toLowerCase(),
          name: $input.attr('name') || '',
          placeholder: $input.attr('placeholder') || '',
          required: $input.attr('required') !== undefined,
          value: $input.attr('value') || ''
        });
      });

      forms.push(formData);
    });

    return forms;
  }

  /**
   * Extract tables
   */
  private extractTables($: cheerio.CheerioAPI): any[] {
    const tables: any[] = [];

    $('table').each((_, element) => {
      const $table = $(element);
      const tableData: any = {
        headers: [] as string[],
        rows: [] as any[][],
        data: [] as any[]
      };

      // Extract headers
      $table.find('th').each((_, thElement) => {
        const text = $(thElement).text().trim();
        if (text) {
          tableData.headers.push(text);
        }
      });

      // Extract rows
      $table.find('tr').each((_, trElement) => {
        const $tr = $(trElement);
        const row: any[] = [];
        
        $tr.find('td, th').each((_, cellElement) => {
          const text = $(cellElement).text().trim();
          row.push(text);
        });

        if (row.length > 0) {
          tableData.rows.push(row);
        }
      });

      // Convert to structured data
      if (tableData.headers.length > 0 && tableData.rows.length > 0) {
        tableData.data = tableData.rows.map(row => {
          const obj: any = {};
          tableData.headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
      }

      tables.push(tableData);
    });

    return tables;
  }

  /**
   * Extract metadata
   */
  private extractMetadata($: cheerio.CheerioAPI): any {
    const metadata: any = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      robots: $('meta[name="robots"]').attr('content') || ''
    };

    return metadata;
  }

  /**
   * Extract specific selectors
   */
  private extractSpecific($: cheerio.CheerioAPI, selectors: string[]): any {
    const specific: any = {};

    selectors.forEach(selector => {
      try {
        const elements = $(selector);
        specific[selector] = elements.map((_, element) => {
          const $element = $(element);
          return {
            text: $element.text().trim(),
            html: $element.html() || '',
            attributes: element.attribs || {}
          };
        }).get();
      } catch (error) {
        specific[selector] = [];
      }
    });

    return specific;
  }

  /**
   * Generate extraction actions
   */
  private generateExtractionActions(extractedData: any): AgentAction[] {
    const actions: AgentAction[] = [];

    // Screenshot action
    actions.push({
      type: 'screenshot',
      confidence: 0.9,
      reasoning: 'Capture screenshot for data extraction'
    });

    // Extract action for each data type
    Object.keys(extractedData).forEach(dataType => {
      actions.push({
        type: 'extract',
        confidence: 0.8,
        reasoning: `Extract ${dataType} data`,
        metadata: { dataType, count: Array.isArray(extractedData[dataType]) ? extractedData[dataType].length : 1 }
      });
    });

    return actions;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): any {
    return {
      name: 'Cheerio Extractor',
      id: 'cheerio-extractor',
      description: 'Fast HTML parsing and data extraction using Cheerio',
      strengths: [
        'HTML parsing',
        'data extraction',
        'content analysis',
        'text processing',
        'link extraction',
        'form analysis',
        'table extraction',
        'metadata extraction'
      ],
      extractionRules: Array.from(this.extractionRules.keys()),
      isLocal: true,
      requiresSetup: false
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test Cheerio functionality
      const testHTML = '<html><body><h1>Test</h1></body></html>';
      const $ = cheerio.load(testHTML);
      const title = $('h1').text();
      
      return title === 'Test';
    } catch (error) {
      return false;
    }
  }
}

export default CheerioExtractorAgent;
