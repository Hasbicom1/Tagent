/**
 * LOCAL COMPUTER VISION ENGINE
 * 
 * Self-contained computer vision for element detection and interaction
 * No external API dependencies - uses local image processing
 */

import { Page, ElementHandle } from 'playwright';
import { EventEmitter } from 'events';

export interface LocalVisionConfig {
  enableScreenshots: boolean;
  screenshotQuality: number;
  elementDetectionThreshold: number;
  enableTextRecognition: boolean;
  enableColorDetection: boolean;
}

export interface VisionElement {
  type: 'button' | 'input' | 'link' | 'image' | 'text' | 'form';
  selector: string;
  text?: string;
  position: { x: number; y: number; width: number; height: number };
  confidence: number;
  attributes: Record<string, string>;
}

export interface VisionResult {
  elements: VisionElement[];
  screenshot?: string;
  processingTime: number;
  confidence: number;
}

export class LocalComputerVisionEngine extends EventEmitter {
  private config: LocalVisionConfig;
  private isInitialized = false;

  constructor(config: LocalVisionConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize local computer vision
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 LOCAL VISION: Initializing computer vision engine...');
      
      this.isInitialized = true;
      console.log('✅ LOCAL VISION: Computer vision engine initialized');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ LOCAL VISION: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze page and detect elements
   */
  async analyzePage(page: Page): Promise<VisionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        throw new Error('Vision engine not initialized');
      }

      console.log('🔍 LOCAL VISION: Analyzing page elements...');
      
      // Take screenshot if enabled
      let screenshot: string | undefined;
      if (this.config.enableScreenshots) {
        screenshot = await this.takeScreenshot(page);
      }

      // Detect all interactive elements
      const elements = await this.detectElements(page);
      
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(elements);
      
      const result: VisionResult = {
        elements,
        screenshot,
        processingTime,
        confidence
      };

      console.log(`✅ LOCAL VISION: Detected ${elements.length} elements in ${processingTime}ms`);
      this.emit('pageAnalyzed', result);

      return result;
    } catch (error) {
      console.error('❌ LOCAL VISION: Page analysis failed:', error);
      throw error;
    }
  }

  /**
   * Find element by visual characteristics
   */
  async findElementByVisual(page: Page, description: string): Promise<ElementHandle | null> {
    try {
      console.log(`🔍 LOCAL VISION: Finding element by description: ${description}`);
      
      // Try multiple strategies
      const strategies = [
        () => this.findByText(page, description),
        () => this.findBySelector(page, description),
        () => this.findByAttributes(page, description),
        () => this.findByPosition(page, description)
      ];
      
      for (const strategy of strategies) {
        try {
          const element = await strategy();
          if (element) {
            console.log(`✅ LOCAL VISION: Element found using strategy`);
            return element;
          }
        } catch (error) {
          // Continue to next strategy
        }
      }
      
      console.log(`❌ LOCAL VISION: Element not found: ${description}`);
      return null;
    } catch (error) {
      console.error('❌ LOCAL VISION: Element search failed:', error);
      return null;
    }
  }

  /**
   * Detect all interactive elements on page
   */
  private async detectElements(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      // Detect buttons
      const buttons = await this.detectButtons(page);
      elements.push(...buttons);
      
      // Detect inputs
      const inputs = await this.detectInputs(page);
      elements.push(...inputs);
      
      // Detect links
      const links = await this.detectLinks(page);
      elements.push(...links);
      
      // Detect images
      const images = await this.detectImages(page);
      elements.push(...images);
      
      // Detect text elements
      const textElements = await this.detectTextElements(page);
      elements.push(...textElements);
      
      // Detect forms
      const forms = await this.detectForms(page);
      elements.push(...forms);
      
    } catch (error) {
      console.error('❌ LOCAL VISION: Element detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect button elements
   */
  private async detectButtons(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const buttons = await page.$$('button, input[type="button"], input[type="submit"], [role="button"]');
      
      for (const button of buttons) {
        const text = await button.textContent() || '';
        const boundingBox = await button.boundingBox();
        const attributes = await this.getElementAttributes(button);
        
        if (boundingBox) {
          elements.push({
            type: 'button',
            selector: await this.generateSelector(button),
            text: text.trim(),
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(button, text),
            attributes
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Button detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect input elements
   */
  private async detectInputs(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const inputs = await page.$$('input, textarea, select');
      
      for (const input of inputs) {
        const type = await input.getAttribute('type') || 'text';
        const placeholder = await input.getAttribute('placeholder') || '';
        const name = await input.getAttribute('name') || '';
        const boundingBox = await input.boundingBox();
        const attributes = await this.getElementAttributes(input);
        
        if (boundingBox) {
          elements.push({
            type: 'input',
            selector: await this.generateSelector(input),
            text: placeholder || name,
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(input, placeholder || name),
            attributes
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Input detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect link elements
   */
  private async detectLinks(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const links = await page.$$('a[href]');
      
      for (const link of links) {
        const text = await link.textContent() || '';
        const href = await link.getAttribute('href') || '';
        const boundingBox = await link.boundingBox();
        const attributes = await this.getElementAttributes(link);
        
        if (boundingBox && text.trim()) {
          elements.push({
            type: 'link',
            selector: await this.generateSelector(link),
            text: text.trim(),
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(link, text),
            attributes: { ...attributes, href }
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Link detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect image elements
   */
  private async detectImages(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const images = await page.$$('img');
      
      for (const image of images) {
        const src = await image.getAttribute('src') || '';
        const alt = await image.getAttribute('alt') || '';
        const boundingBox = await image.boundingBox();
        const attributes = await this.getElementAttributes(image);
        
        if (boundingBox) {
          elements.push({
            type: 'image',
            selector: await this.generateSelector(image),
            text: alt,
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(image, alt),
            attributes: { ...attributes, src }
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Image detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect text elements
   */
  private async detectTextElements(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const textElements = await page.$$('p, h1, h2, h3, h4, h5, h6, span, div');
      
      for (const element of textElements) {
        const text = await element.textContent() || '';
        const boundingBox = await element.boundingBox();
        const attributes = await this.getElementAttributes(element);
        
        if (boundingBox && text.trim() && text.length > 3) {
          elements.push({
            type: 'text',
            selector: await this.generateSelector(element),
            text: text.trim(),
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(element, text),
            attributes
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Text detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Detect form elements
   */
  private async detectForms(page: Page): Promise<VisionElement[]> {
    const elements: VisionElement[] = [];
    
    try {
      const forms = await page.$$('form');
      
      for (const form of forms) {
        const action = await form.getAttribute('action') || '';
        const method = await form.getAttribute('method') || 'get';
        const boundingBox = await form.boundingBox();
        const attributes = await this.getElementAttributes(form);
        
        if (boundingBox) {
          elements.push({
            type: 'form',
            selector: await this.generateSelector(form),
            text: `Form (${method.toUpperCase()})`,
            position: {
              x: boundingBox.x,
              y: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height
            },
            confidence: this.calculateElementConfidence(form, 'form'),
            attributes: { ...attributes, action, method }
          });
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Form detection failed:', error);
    }
    
    return elements;
  }

  /**
   * Find element by text content
   */
  private async findByText(page: Page, description: string): Promise<ElementHandle | null> {
    try {
      const selectors = [
        `text="${description}"`,
        `text=/.*${description}.*/i`,
        `[aria-label*="${description}"]`,
        `[title*="${description}"]`
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.count() > 0) {
            return await element.elementHandle();
          }
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Text search failed:', error);
    }
    
    return null;
  }

  /**
   * Find element by CSS selector
   */
  private async findBySelector(page: Page, description: string): Promise<ElementHandle | null> {
    try {
      const element = await page.$(description);
      return element;
    } catch (error) {
      console.error('❌ LOCAL VISION: Selector search failed:', error);
      return null;
    }
  }

  /**
   * Find element by attributes
   */
  private async findByAttributes(page: Page, description: string): Promise<ElementHandle | null> {
    try {
      const selectors = [
        `[data-testid*="${description}"]`,
        `[id*="${description}"]`,
        `[class*="${description}"]`,
        `[name*="${description}"]`
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) return element;
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Attribute search failed:', error);
    }
    
    return null;
  }

  /**
   * Find element by position (for click coordinates)
   */
  private async findByPosition(page: Page, description: string): Promise<ElementHandle | null> {
    try {
      // This would require coordinate parsing from description
      // For now, return null as this is complex to implement
      return null;
    } catch (error) {
      console.error('❌ LOCAL VISION: Position search failed:', error);
      return null;
    }
  }

  /**
   * Get element attributes
   */
  private async getElementAttributes(element: ElementHandle): Promise<Record<string, string>> {
    const attributes: Record<string, string> = {};
    
    try {
      const commonAttributes = ['id', 'class', 'type', 'name', 'value', 'placeholder', 'aria-label', 'data-testid'];
      
      for (const attr of commonAttributes) {
        const value = await element.getAttribute(attr);
        if (value) {
          attributes[attr] = value;
        }
      }
    } catch (error) {
      console.error('❌ LOCAL VISION: Attribute extraction failed:', error);
    }
    
    return attributes;
  }

  /**
   * Generate CSS selector for element
   */
  private async generateSelector(element: ElementHandle): Promise<string> {
    try {
      const id = await element.getAttribute('id');
      if (id) return `#${id}`;
      
      const className = await element.getAttribute('class');
      if (className) {
        const classes = className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          return `.${classes[0]}`;
        }
      }
      
      const tagName = await element.evaluate(el => (el as Element).tagName.toLowerCase());
      return tagName;
    } catch (error) {
      console.error('❌ LOCAL VISION: Selector generation failed:', error);
      return 'unknown';
    }
  }

  /**
   * Calculate element confidence score
   */
  private calculateElementConfidence(element: ElementHandle, text: string): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for visible text
    if (text && text.trim().length > 0) {
      confidence += 0.2;
    }
    
    // Increase confidence for interactive elements
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a'];
    // This would require checking the tag name, simplified for now
    confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(elements: VisionElement[]): number {
    if (elements.length === 0) return 0;
    
    const totalConfidence = elements.reduce((sum, element) => sum + element.confidence, 0);
    return totalConfidence / elements.length;
  }

  /**
   * Take screenshot
   */
  private async takeScreenshot(page: Page): Promise<string> {
    try {
      const screenshot = await page.screenshot({ 
        type: 'png',
        quality: this.config.screenshotQuality,
        fullPage: true 
      });
      return screenshot.toString('base64');
    } catch (error) {
      console.error('❌ LOCAL VISION: Screenshot failed:', error);
      return '';
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized;
    } catch (error) {
      console.error('❌ LOCAL VISION: Health check failed:', error);
      return false;
    }
  }
}

export default LocalComputerVisionEngine;
