/**
 * Cheerio Extractor Agent - Real Implementation
 * HTML parsing and data extraction using Cheerio
 */

import { logger } from '../logger';
import * as cheerio from 'cheerio';
import axios from 'axios';

export interface CheerioExtractorConfig {
  timeout: number;
  retries: number;
  userAgent: string;
  followRedirects: boolean;
}

export interface CheerioExtractorTask {
  id: string;
  sessionId: string;
  instruction: string;
  url?: string;
  html?: string;
  selectors?: Record<string, string>;
  context?: any;
}

export interface CheerioExtractorResult {
  success: boolean;
  result?: {
    message: string;
    data: any;
    extracted: any[];
    metadata: any;
  };
  error?: string;
  executionTime?: number;
}

export class CheerioExtractorAgent {
  private config: CheerioExtractorConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<CheerioExtractorConfig>) {
    this.config = {
      timeout: config?.timeout ?? 30000,
      retries: config?.retries ?? 3,
      userAgent: config?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      followRedirects: config?.followRedirects ?? true
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Cheerio Extractor: Initializing real HTML parsing agent...');

      // Test Cheerio functionality
      await this.testCheerioFunctionality();
      
      this.isInitialized = true;
      logger.info('✅ Cheerio Extractor: Real HTML parsing agent initialized');
    } catch (error) {
      logger.error('❌ Cheerio Extractor: Initialization failed:', error);
      throw error;
    }
  }

  private async testCheerioFunctionality(): Promise<void> {
    try {
      const testHtml = '<html><body><h1>Test</h1></body></html>';
      const $ = cheerio.load(testHtml);
      const title = $('h1').text();
      
      if (title === 'Test') {
        logger.info('✅ Cheerio Extractor: Cheerio functionality test passed');
      } else {
        throw new Error('Cheerio test failed');
      }
    } catch (error) {
      throw new Error(`Cheerio functionality test failed: ${error}`);
    }
  }

  async executeTask(task: CheerioExtractorTask): Promise<CheerioExtractorResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 Cheerio Extractor: Executing real HTML parsing task', {
        taskId: task.id,
        instruction: task.instruction,
        hasUrl: !!task.url,
        hasHtml: !!task.html
      });

      // Get HTML content
      const html = await this.getHtmlContent(task);
      
      // Parse HTML with Cheerio
      const $ = cheerio.load(html);
      
      // Extract data based on instruction
      const extractedData = await this.extractData($, task);
      
      // Generate metadata
      const metadata = this.generateMetadata($, task);

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Cheerio Extractor: HTML parsing completed', {
        taskId: task.id,
        extractedCount: extractedData.length,
        executionTime
      });

      return {
        success: true,
        result: {
          message: 'Cheerio Extractor data extraction completed successfully',
          data: extractedData,
          extracted: extractedData,
          metadata: metadata
        },
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Cheerio Extractor: HTML parsing failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cheerio Extractor execution failed',
        executionTime
      };
    }
  }

  private async getHtmlContent(task: CheerioExtractorTask): Promise<string> {
    if (task.html) {
      return task.html;
    }

    if (task.url) {
      return await this.fetchHtmlFromUrl(task.url);
    }

    throw new Error('No HTML content or URL provided');
  }

  private async fetchHtmlFromUrl(url: string): Promise<string> {
    const maxRetries = this.config.retries;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🔄 Cheerio Extractor: Fetching HTML from ${url} (attempt ${attempt}/${maxRetries})`);
        
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent
          },
          maxRedirects: this.config.followRedirects ? 10 : 0
        });

        if (response.status === 200) {
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error) {
        logger.warn(`⚠️ Cheerio Extractor: Fetch attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch HTML after ${maxRetries} attempts: ${error}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw new Error('Failed to fetch HTML after all retries');
  }

  private async extractData($: cheerio.CheerioAPI, task: CheerioExtractorTask): Promise<any[]> {
    const extractedData: any[] = [];
    const instruction = task.instruction.toLowerCase();

    try {
      // Extract based on instruction keywords
      if (instruction.includes('title') || instruction.includes('headline')) {
        const titles = this.extractTitles($);
        extractedData.push(...titles);
      }

      if (instruction.includes('link') || instruction.includes('url')) {
        const links = this.extractLinks($);
        extractedData.push(...links);
      }

      if (instruction.includes('image') || instruction.includes('photo')) {
        const images = this.extractImages($);
        extractedData.push(...images);
      }

      if (instruction.includes('text') || instruction.includes('content')) {
        const texts = this.extractTexts($);
        extractedData.push(...texts);
      }

      if (instruction.includes('form') || instruction.includes('input')) {
        const forms = this.extractForms($);
        extractedData.push(...forms);
      }

      if (instruction.includes('table') || instruction.includes('data')) {
        const tables = this.extractTables($);
        extractedData.push(...tables);
      }

      if (instruction.includes('meta') || instruction.includes('information')) {
        const meta = this.extractMeta($);
        extractedData.push(...meta);
      }

      // Use custom selectors if provided
      if (task.selectors) {
        const customData = this.extractWithCustomSelectors($, task.selectors);
        extractedData.push(...customData);
      }

      // If no specific instruction, extract common elements
      if (extractedData.length === 0) {
        const commonData = this.extractCommonanys($);
        extractedData.push(...commonData);
      }

      return extractedData;

    } catch (error) {
      logger.warn('⚠️ Cheerio Extractor: Data extraction failed:', error);
      return [];
    }
  }

  private extractTitles($: cheerio.CheerioAPI): any[] {
    const titles: any[] = [];
    
    $('h1, h2, h3, h4, h5, h6').each((index: number, element: any) => {
      const $el = $(element);
      titles.push({
        type: 'title',
        level: element.tagName,
        text: $el.text().trim(),
        selector: this.getanySelector($el),
        index: index
      });
    });

    return titles;
  }

  private extractLinks($: cheerio.CheerioAPI): any[] {
    const links: any[] = [];
    
    $('a[href]').each((index: number, element: any) => {
      const $el = $(element);
      links.push({
        type: 'link',
        text: $el.text().trim(),
        href: $el.attr('href'),
        title: $el.attr('title'),
        selector: this.getanySelector($el),
        index: index
      });
    });

    return links;
  }

  private extractImages($: cheerio.CheerioAPI): any[] {
    const images: any[] = [];
    
    $('img').each((index: number, element: any) => {
      const $el = $(element);
      images.push({
        type: 'image',
        src: $el.attr('src'),
        alt: $el.attr('alt'),
        title: $el.attr('title'),
        width: $el.attr('width'),
        height: $el.attr('height'),
        selector: this.getanySelector($el),
        index: index
      });
    });

    return images;
  }

  private extractTexts($: cheerio.CheerioAPI): any[] {
    const texts: any[] = [];
    
    $('p, div, span').each((index: number, element: any) => {
      const $el = $(element);
      const text = $el.text().trim();
      
      if (text.length > 10) { // Only include meaningful text
        texts.push({
          type: 'text',
          text: text,
          tag: element.tagName,
          selector: this.getanySelector($el),
          index: index
        });
      }
    });

    return texts;
  }

  private extractForms($: cheerio.CheerioAPI): any[] {
    const forms: any[] = [];
    
    $('form').each((index: number, formany: any) => {
      const $form = $(formany);
      const inputs: any[] = [];
      
      $form.find('input, textarea, select').each((inputIndex: number, inputany: any) => {
        const $input = $(inputany);
        inputs.push({
          type: $input.attr('type') || inputany.tagName,
          name: $input.attr('name'),
          id: $input.attr('id'),
          placeholder: $input.attr('placeholder'),
          required: $input.attr('required') !== undefined
        });
      });

      forms.push({
        type: 'form',
        action: $form.attr('action'),
        method: $form.attr('method'),
        inputs: inputs,
        selector: this.getanySelector($form),
        index: index
      });
    });

    return forms;
  }

  private extractTables($: cheerio.CheerioAPI): any[] {
    const tables: any[] = [];
    
    $('table').each((index: number, tableany: any) => {
      const $table = $(tableany);
      const rows: any[] = [];
      
      $table.find('tr').each((rowIndex: number, rowany: any) => {
        const $row = $(rowany);
        const cells: string[] = [];
        
        $row.find('td, th').each((cellIndex: number, cellany: any) => {
          cells.push($(cellany).text().trim());
        });
        
        rows.push({
          index: rowIndex,
          cells: cells
        });
      });

      tables.push({
        type: 'table',
        rows: rows,
        selector: this.getanySelector($table),
        index: index
      });
    });

    return tables;
  }

  private extractMeta($: cheerio.CheerioAPI): any[] {
    const meta: any[] = [];
    
    $('meta').each((index: number, element: any) => {
      const $el = $(element);
      meta.push({
        type: 'meta',
        name: $el.attr('name'),
        property: $el.attr('property'),
        content: $el.attr('content'),
        selector: this.getanySelector($el),
        index: index
      });
    });

    return meta;
  }

  private extractWithCustomSelectors($: cheerio.CheerioAPI, selectors: Record<string, string>): any[] {
    const customData: any[] = [];
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const elements = $(selector);
        elements.each((index: number, element: any) => {
          const $el = $(element);
          customData.push({
            type: 'custom',
            key: key,
            selector: selector,
            text: $el.text().trim(),
            html: $el.html(),
            attributes: this.getanyAttributes($el),
            index: index
          });
        });
      } catch (error) {
        logger.warn(`⚠️ Cheerio Extractor: Custom selector failed for ${key}:`, error);
      }
    }

    return customData;
  }

  private extractCommonanys($: cheerio.CheerioAPI): any[] {
    const common: any[] = [];
    
    // Extract common elements
    $('h1, h2, h3, p, a, img, button').each((index: number, element: any) => {
      const $el = $(element);
      common.push({
        type: 'element',
        tag: element.tagName,
        text: $el.text().trim(),
        attributes: this.getanyAttributes($el),
        selector: this.getanySelector($el),
        index: index
      });
    });

    return common;
  }

  private getanySelector($el: cheerio.Cheerio<any>): string {
    // Generate a simple selector for the element
    const tag = $el.prop('tagName')?.toLowerCase();
    const id = $el.attr('id');
    const className = $el.attr('class');
    
    if (id) {
      return `#${id}`;
    } else if (className) {
      return `.${className.split(' ')[0]}`;
    } else {
      return tag || 'unknown';
    }
  }

  private getanyAttributes($el: cheerio.Cheerio<any>): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    if ($el.length > 0) {
      const element = $el[0];
      if (element.type === 'tag') {
        Object.keys(element.attribs || {}).forEach(key => {
          attributes[key] = element.attribs[key];
        });
      }
    }
    
    return attributes;
  }

  private generateMetadata($: cheerio.CheerioAPI, task: CheerioExtractorTask): any {
    return {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content'),
      author: $('meta[name="author"]').attr('content'),
      language: $('html').attr('lang'),
      charset: $('meta[charset]').attr('charset'),
      viewport: $('meta[name="viewport"]').attr('content'),
      url: task.url,
      extractedAt: new Date().toISOString(),
      elementCount: {
        headings: $('h1, h2, h3, h4, h5, h6').length,
        links: $('a').length,
        images: $('img').length,
        forms: $('form').length,
        tables: $('table').length,
        paragraphs: $('p').length
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized;
    } catch {
      return false;
    }
  }

  getCapabilities(): string[] {
    return [
      'html_parsing',
      'data_extraction',
      'selector_based_extraction',
      'meta_information_extraction',
      'form_analysis',
      'table_extraction',
      'link_extraction',
      'image_extraction',
      'text_extraction',
      'custom_selector_support'
    ];
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      capabilities: this.getCapabilities(),
      timeout: this.config.timeout,
      retries: this.config.retries,
      userAgent: this.config.userAgent
    };
  }
}

export default CheerioExtractorAgent;
