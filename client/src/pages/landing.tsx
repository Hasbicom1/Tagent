import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Play, Bot, Monitor, CreditCard, ArrowRight, Terminal, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EnhancedTerminalInterface from '@/components/command/EnhancedTerminalInterface';

export default function Landing() {
  return <EnhancedTerminalInterface />;
}