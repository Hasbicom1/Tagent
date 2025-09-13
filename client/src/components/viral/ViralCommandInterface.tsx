import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Dice6,
  Terminal,
  Rocket,
  Users,
  DollarSign,
  Mail,
  Coffee,
  Check
} from 'lucide-react';

interface ViralCommandInterfaceProps {
  command: string;
  data?: any;
  onBack: () => void;
  onPayment: (method: string) => void;
}

interface ProgressiveWebAppBuilderProps {
  command: string;
  onBack: () => void;
  onPayment: (method: string) => void;
}

// AI Agent messages for building sections
const AI_BUILDER_MESSAGES = {
  show_hero: {
    buildingMsg: "Building hero section...",
    completedMsg: "✅ Hero section built successfully!",
    icon: Rocket,
    title: "AI FOR $1",
    subtitle: "AI dreams shouldn't cost more than a coffee",
    description: "Revolutionary $1 AI agent platform - making AI accessible for everyone, everywhere.",
  },
  show_features: {
    buildingMsg: "Integrating features...",
    completedMsg: "✅ Features integrated successfully!",
    icon: Sparkles,
    title: "Powerful Features",
    subtitle: "Everything you need for $1",
    description: "24-hour AI agent access, live browser automation, terminal interface, and seamless payment processing.",
  },
  show_pricing: {
    buildingMsg: "Calculating pricing models...",
    completedMsg: "✅ Pricing optimized successfully!",
    icon: DollarSign,
    title: "Simple Pricing",
    subtitle: "One price, unlimited possibilities",
    description: "Pay just $1 for 24 hours of full AI agent access. No subscriptions, no hidden fees, no corporate greed.",
  },
  show_specs: {
    buildingMsg: "Loading technical specifications...",
    completedMsg: "✅ Specs loaded successfully!",
    icon: Terminal,
    title: "Technical Specs",
    subtitle: "Built for reliability & speed",
    description: "React + TypeScript frontend, Express.js backend, PostgreSQL database, Stripe payments, WebSocket real-time communication.",
  },
  show_contact: {
    buildingMsg: "Connecting contact systems...",
    completedMsg: "✅ Contact systems connected!",
    icon: Mail,
    title: "Get In Touch",
    subtitle: "Questions? We're here to help!",
    description: "Reach out for support, partnerships, or just to say hello. We believe in building community around accessible AI.",
  },
};

function ProgressiveWebAppBuilder({ command, onBack, onPayment }: ProgressiveWebAppBuilderProps) {
  const [progress, setProgress] = useState(0);
  const [isBuilding, setIsBuilding] = useState(true);
  const [buildComplete, setBuildComplete] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const sectionData = AI_BUILDER_MESSAGES[command as keyof typeof AI_BUILDER_MESSAGES] || AI_BUILDER_MESSAGES.show_hero;

  useEffect(() => {
    // Start building animation
    const buildingInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(buildingInterval);
          setIsBuilding(false);
          setBuildComplete(true);
          
          // Show card with smooth animation after build complete
          setTimeout(() => {
            setShowCard(true);
            // Smooth scroll to the card
            setTimeout(() => {
              if (cardRef.current) {
                cardRef.current.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'center'
                });
              }
            }, 300);
          }, 500);
          
          return 100;
        }
        return prev + 2; // Increment by 2% for smooth animation
      });
    }, 80); // Update every 80ms for satisfying build feel

    return () => clearInterval(buildingInterval);
  }, []);

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
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            AI_AGENT_BUILDING
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* AI Agent Building Interface */}
        <div className="space-y-6">
          {/* AI Agent Status */}
          <Card className="border-primary/20 bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
                <span className="text-primary font-mono">AI Agent Status</span>
              </div>
              
              {isBuilding && (
                <div className="space-y-3">
                  <div className="text-muted-foreground">
                    {sectionData.buildingMsg}
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="text-sm text-muted-foreground">
                    {progress.toFixed(0)}% Complete
                  </div>
                </div>
              )}

              {buildComplete && (
                <div className="space-y-3">
                  <div className="text-primary flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {sectionData.completedMsg}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ready to view your web app section
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Built Web App Section */}
          {showCard && (
            <div 
              ref={cardRef}
              className="animate-in slide-in-from-bottom duration-500 ease-out"
            >
              <Card className="border-primary/30 bg-gradient-to-br from-card to-card/80 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <sectionData.icon className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-3xl text-primary">
                    {sectionData.title}
                  </CardTitle>
                  <p className="text-lg text-muted-foreground">
                    {sectionData.subtitle}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-foreground leading-relaxed">
                    {sectionData.description}
                  </p>

                  {/* Action buttons for specific sections */}
                  {command === 'show_pricing' && (
                    <div className="flex gap-3 justify-center">
                      <Button 
                        onClick={() => onPayment('stripe')}
                        className="bg-primary hover:bg-primary/90"
                        data-testid="button-get-started"
                      >
                        <Rocket className="w-4 h-4 mr-2" />
                        Get Started - $1
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => onPayment('custom')}
                        className="border-primary/50 hover:bg-primary/10"
                        data-testid="button-buy-coffee"
                      >
                        <Coffee className="w-4 h-4 mr-2" />
                        Buy More Coffee
                      </Button>
                    </div>
                  )}

                  {command === 'show_hero' && (
                    <div className="text-center">
                      <Button 
                        onClick={() => onPayment('stripe')}
                        size="lg"
                        className="bg-primary hover:bg-primary/90"
                        data-testid="button-start-agent"
                      >
                        <Rocket className="w-4 h-4 mr-2" />
                        Start Your AI Agent - $1
                      </Button>
                    </div>
                  )}

                  {command === 'show_contact' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center p-4 rounded border border-primary/20">
                          <Mail className="w-6 h-6 mx-auto mb-2 text-primary" />
                          <div className="font-mono text-sm">support@agentforall.ai</div>
                        </div>
                        <div className="text-center p-4 rounded border border-primary/20">
                          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                          <div className="font-mono text-sm">Community Discord</div>
                        </div>
                      </div>
                      <div className="text-center">
                        <Button 
                          onClick={() => onPayment('stripe')}
                          variant="outline"
                          className="border-primary hover:bg-primary/10"
                          data-testid="button-get-support"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Get Personal Support - $1
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Continue Building Prompt */}
          {buildComplete && (
            <div className="text-center space-y-4 mt-8">
              <div className="text-muted-foreground">
                Want to build more sections? Go back and try other commands!
              </div>
              <div className="flex justify-center gap-2 text-sm">
                <Badge variant="outline">h</Badge>
                <Badge variant="outline">f</Badge>
                <Badge variant="outline">p</Badge>
                <Badge variant="outline">s</Badge>
                <Badge variant="outline">c</Badge>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  
  // Handle discovery commands - PROGRESSIVE WEB APP BUILDER
  if (command.includes('show_')) {
    return <ProgressiveWebAppBuilder command={command} onBack={onBack} onPayment={onPayment} />;
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