import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Twitter, 
  Instagram, 
  Copy,
  Bitcoin,
  CreditCard,
  Zap,
  X,
  Dog,
  Cat,
  Fish,
  Rabbit,
  Sparkles,
  Dice6
} from 'lucide-react';

interface ViralCommandInterfaceProps {
  command: string;
  data?: any;
  onBack: () => void;
  onPayment: (method: string) => void;
}

// Pixel art for different animals
const PIXEL_ART = {
  dog: `
    ░░░░░██████░░░░░
  ░░██████████████░░  
  ░██▓▓██████▓▓██░
    ░████████████░
      ░████████░
        ░░██░░
  `,
  cat: `
    ░░██░░░░██░░
  ░░████████████░░
  ░██▓▓██████▓▓██░
  ░████▓▓▓▓▓▓████░
    ░██████████░
      ░██░░██░
  `,
  hamster: `
    ░░████████░░
  ░░██████████░░
  ░██▓▓████▓▓██░
  ░████████████░
    ░████████░
      ░░░░░░
  `,
  fish: `
      ░░░░░░██
    ░░██████████
  ░░██▓▓██████░░
    ░██████████
      ░░░░░░██
  `,
  lucky: `
    ░░████████░░
  ░░██░░░░░░██░░
  ░██░░████░░██░
  ░██░░████░░██░
  ░░██░░░░░░██░░
    ░░████████░░
  `
};

const MESSAGES = {
  dog: {
    title: "YOUR DOG BELIEVES IN YOU!",
    icon: Dog,
    message: "Even dogs know that $1 can change everything. Your furry friend sees the dreamer in you - are you ready to make them proud?",
    cta: "BET $1 ON YOUR DREAM"
  },
  cat: {
    title: "EVEN CATS KNOW YOU'RE DESTINED FOR GREATNESS!", 
    icon: Cat,
    message: "Your cat might act aloof, but deep down they believe in your potential. Time to show them (and yourself) what you're made of.",
    cta: "BET $1 ON YOUR FUTURE"
  },
  hamster: {
    title: "HAMSTERS DREAM BIG TOO!",
    icon: Rabbit,
    message: "Small but mighty - just like your $1 investment. Your hamster runs on that wheel every day chasing dreams. Now it's your turn.",
    cta: "BET $1 ON BIG DREAMS"
  },
  fish: {
    title: "YOUR FISH SWIMS TOWARD YOUR DREAMS!",
    icon: Fish,
    message: "Swimming against the current takes courage. Your fish does it every day - now let them inspire your next big move.",
    cta: "BET $1 ON COURAGE"
  },
  lucky: {
    title: "FEELING LUCKY? YOUR DREAMS ARE THE BEST BET!",
    icon: Dice6,
    message: "Fortune favors the bold. While others spend $100+ on AI subscriptions, you're smart enough to start with just $1.",
    cta: "PLACE YOUR LUCKY BET"
  }
};

export function ViralCommandInterface({ command, data, onBack, onPayment }: ViralCommandInterfaceProps) {
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Handle discovery commands - return simple placeholder for now
  if (command.includes('show_')) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b border-primary/20 p-4 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={onBack}
              className="text-muted-foreground hover:text-primary"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to chat
            </Button>
            <div className="text-sm text-muted-foreground">
              DISCOVERY_MODE_ACTIVE
            </div>
          </div>
        </div>

        {/* Simple placeholder for discovery content */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-2xl text-primary mb-4">Discovery Mode</div>
            <div className="text-muted-foreground">Command: {command}</div>
            <div className="text-sm text-muted-foreground mt-4">
              This will show the {command.replace('show_', '')} section
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For viral commands, continue with existing logic
  // Determine which content to show based on command
  const getContentKey = () => {
    if (command.includes('dog')) return 'dog';
    if (command.includes('cat')) return 'cat'; 
    if (command.includes('hamster')) return 'hamster';
    if (command.includes('fish')) return 'fish';
    if (command.includes('lucky')) return 'lucky';
    return 'dog'; // default
  };

  const contentKey = getContentKey();
  const content = MESSAGES[contentKey as keyof typeof MESSAGES];
  const pixelArt = PIXEL_ART[contentKey as keyof typeof PIXEL_ART];

  const handlePaymentClick = () => {
    setShowPaymentOptions(true);
  };

  const handleShareClick = async () => {
    const shareText = `Just bet $1 on my ${contentKey} and my dreams! AI shouldn't cost more than coffee - Check out Agent For All!`;
    const shareUrl = window.location.origin;
    
    if (navigator.share) {
      await navigator.share({
        title: 'Agent For All - AI for $1!',
        text: shareText,
        url: shareUrl
      });
    } else {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSocialShare = (platform: string) => {
    const text = `Just bet $1 on my ${contentKey} and my dreams! AI shouldn't cost more than coffee`;
    const url = window.location.origin;
    
    let shareUrl = '';
    if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    } else if (platform === 'instagram') {
      // Instagram doesn't have direct URL sharing, so copy to clipboard
      navigator.clipboard.writeText(`${text} ${url}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      return;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
    }
  };

  if (showPaymentOptions) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b border-primary/20 p-4 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => setShowPaymentOptions(false)}
              className="text-muted-foreground hover:text-primary"
              data-testid="button-back-to-animal"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to your {contentKey}
            </Button>
            <div className="text-sm text-muted-foreground">
              SELECT_PAYMENT_METHOD
            </div>
          </div>
        </div>

        {/* Payment Selection */}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md bg-background/90 border-primary/30 terminal-window crt-screen electric-glow">
            <div className="bg-card border-b border-primary/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-chart-2" />
                  <div className="w-3 h-3 rounded-full bg-chart-3" />
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="ml-4 text-sm font-mono text-muted-foreground">
                    payment_selection.exe
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-primary">HOW DO YOU WANT TO BET $1?</h2>
                <p className="text-sm text-muted-foreground">Choose your revolution</p>
              </div>

              <div className="space-y-3">
                {/* Stripe */}
                <Button 
                  onClick={() => onPayment('stripe')}
                  className="w-full h-12 bg-background border border-primary/30 hover:border-primary text-foreground hover-elevate justify-start"
                  data-testid="button-payment-stripe"
                >
                  <CreditCard className="w-5 h-5 mr-3 text-primary" />
                  <div className="text-left">
                    <div className="font-mono">Credit Card</div>
                    <div className="text-xs text-muted-foreground">Powered by Stripe</div>
                  </div>
                </Button>

                {/* Bitcoin */}
                <Button 
                  onClick={() => onPayment('bitcoin')}
                  className="w-full h-12 bg-background border border-primary/30 hover:border-primary text-foreground hover-elevate justify-start"
                  data-testid="button-payment-bitcoin"
                >
                  <Bitcoin className="w-5 h-5 mr-3 text-orange-500" />
                  <div className="text-left">
                    <div className="font-mono">Bitcoin</div>
                    <div className="text-xs text-muted-foreground">Revolutionary • Low fees</div>
                  </div>
                </Button>

                {/* Ethereum */}
                <Button 
                  onClick={() => onPayment('ethereum')}
                  className="w-full h-12 bg-background border border-primary/30 hover:border-primary text-foreground hover-elevate justify-start"
                  data-testid="button-payment-ethereum"
                >
                  <div className="w-5 h-5 mr-3 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">Ξ</div>
                  <div className="text-left">
                    <div className="font-mono">Ethereum</div>
                    <div className="text-xs text-muted-foreground">Smart contracts</div>
                  </div>
                </Button>

                {/* USDC */}
                <Button 
                  onClick={() => onPayment('usdc')}
                  className="w-full h-12 bg-background border border-primary/30 hover:border-primary text-foreground hover-elevate justify-start"
                  data-testid="button-payment-usdc"
                >
                  <div className="w-5 h-5 mr-3 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">$</div>
                  <div className="text-left">
                    <div className="font-mono">USDC</div>
                    <div className="text-xs text-muted-foreground">Stable • No volatility</div>
                  </div>
                </Button>

                {/* Dogecoin */}
                <Button 
                  onClick={() => onPayment('dogecoin')}
                  className="w-full h-12 bg-background border border-primary/30 hover:border-primary text-foreground hover-elevate justify-start"
                  data-testid="button-payment-dogecoin"
                >
                  <Dog className="w-5 h-5 mr-3 text-yellow-500" />
                  <div className="text-left">
                    <div className="font-mono">Dogecoin</div>
                    <div className="text-xs text-muted-foreground">Fun • Much wow</div>
                  </div>
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                All payments are secure and processed instantly
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-primary/20 p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-muted-foreground hover:text-primary"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to chat
          </Button>
          <div className="text-sm text-muted-foreground">
            VIRAL_MODE_ACTIVE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <Card className="bg-background/90 border-primary/30 overflow-hidden terminal-window crt-screen electric-glow">
            <div className="bg-card border-b border-primary/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-chart-2" />
                  <div className="w-3 h-3 rounded-full bg-chart-3" />
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="ml-4 text-sm font-mono text-muted-foreground">
                    viral_command_activated.exe
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  DREAMS_LOADING
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                {/* Pixel Art Side */}
                <div className="space-y-6 text-center lg:text-left">
                  <div className="space-y-4">
                    <Badge variant="secondary" className="text-sm font-mono border-primary/30">
                      <Zap className="w-3 h-3 mr-2" />
                      VIRAL_COMMAND_ACTIVATED
                    </Badge>
                    
                    <div className="space-y-4">
                      <pre className="text-primary/80 leading-none text-sm font-mono">
                        {pixelArt}
                      </pre>
                      
                      <div className="text-2xl lg:text-3xl font-bold text-primary font-mono flex items-center gap-3">
                        <content.icon className="w-8 h-8" />
                        {content.title}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground font-sans text-base leading-relaxed">
                    {content.message}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    <Button
                      onClick={handleShareClick}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      data-testid="button-share-viral"
                    >
                      {copiedLink ? (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3 mr-1" />
                          Share
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleSocialShare('twitter')}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      data-testid="button-twitter-share"
                    >
                      <Twitter className="w-3 h-3 mr-1" />
                      Tweet
                    </Button>
                    
                    <Button
                      onClick={() => handleSocialShare('instagram')}
                      variant="outline"
                      size="sm" 
                      className="text-xs"
                      data-testid="button-instagram-share"
                    >
                      <Instagram className="w-3 h-3 mr-1" />
                      Instagram
                    </Button>
                  </div>
                </div>

                {/* CTA Side */}
                <div className="space-y-6 text-center">
                  <div className="bg-card/50 rounded border border-primary/10 p-6 space-y-4">
                    <div className="text-primary font-mono text-lg">
                      AI DREAMS ≠ $100/MONTH
                    </div>
                    <div className="text-muted-foreground text-sm">
                      While others charge a fortune for AI access, we believe in accessibility. 
                      Your {contentKey} believes in your dreams - and so do we.
                    </div>
                  </div>
                  
                  <Button
                    onClick={handlePaymentClick}
                    size="lg"
                    className="w-full h-14 text-lg font-mono bg-primary text-primary-foreground hover:bg-primary/90"
                    data-testid="button-start-payment"
                  >
                    <Heart className="w-5 h-5 mr-3" />
                    {content.cta}
                  </Button>
                  
                  <div className="text-xs text-muted-foreground">
                    💡 Screenshot this and share it! Perfect for social media
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}