import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const ASCII_BG = `
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒ MATRIX • DREAM • REVOLUTION • ACCESSIBLE AI ▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
▒ 0101010101010011010101010101010101010101 ▒
▒ 1101001010010100011100010010101010010101 ▒
▒ 0101010101110001010101010101010101000101 ▒
▒ 0011010101000101011100101010101010010101 ▒
▒ 1010010101010100101010100101010101001101 ▒
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
`;

interface CLIWindowProps {
  title: string;
  subtitle: string;
  lines: string[];
  filename: string;
}

function CLIWindow({ title, subtitle, lines, filename }: CLIWindowProps) {
  return (
    <Card className="bg-background/80 border-primary/30">
      <div className="bg-card border-b border-primary/20 p-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <div className="w-3 h-3 rounded-full bg-chart-3" />
          <div className="w-3 h-3 rounded-full bg-chart-2" />
          <div className="ml-4 text-sm font-mono text-muted-foreground">
            {filename}
          </div>
        </div>
      </div>
      <div className="p-8 space-y-4">
        <h2 className="text-2xl font-bold font-mono text-primary">{title}</h2>
        <p className="text-sm text-muted-foreground font-mono">{subtitle}</p>
        <div className="bg-card/50 rounded border border-primary/10 p-4 space-y-2 text-left font-mono text-sm">
          <div className="text-muted-foreground">// Commands</div>
          {lines.map((l, i) => (
            <div key={i} className="text-primary">{l}</div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Subtle ASCII backdrop active • Slightly visible for hacker aesthetic
        </div>
      </div>
    </Card>
  );
}

export default function AboutCLIPage() {
  const [, setLocation] = useLocation();

  const content = {
    project: {
      title: "Project • Revolutionary AI platform",
      subtitle: "Medium TLC: iOS/Linux command quickstart",
      lines: [
        "$ curl -sSL https://get.agentforall.ai/install | bash",
        "$ sudo apt-get update && sudo apt-get install agentforall",
        "$ brew tap agentforall/tap && brew install agentforall",
        "$ agentforall init --whitelist",
        "$ agentforall run --browser --secure --multi-modal",
      ],
      filename: "about_project.sh",
    },
    concept: {
      title: "Concept • The AI revolution philosophy",
      subtitle: "Medium TLC: philosophy rendered as commands",
      lines: [
        "$ echo 'AI_for_All' > mission.txt",
        "$ cat mission.txt | tlc --explain --medium",
        "$ export ACCESSIBILITY=1 && export PRIVACY=1",
        "$ tlc run --ethics --open --human-centered",
        "$ tlc render --story --collaborative",
      ],
      filename: "about_concept.sh",
    },
    collaboration: {
      title: "Collaboration • Join the dream team",
      subtitle: "Medium TLC: contribute via CLI",
      lines: [
        "$ git clone https://github.com/agentforall/dreams.git",
        "$ cd dreams && npm i && npm run dev",
        "$ tlc invite --role=visionary --impact=high",
        "$ curl -X POST https://api.agentforall.ai/join --data '{team:"dream"}'",
        "$ tlc connect --community --feedback --build",
      ],
      filename: "about_collaboration.sh",
    },
  } as const;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono relative overflow-hidden">
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Subtle ASCII backdrop - low opacity, non-interactive */}
      <motion.pre
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none select-none absolute inset-0 m-0 p-6 text-[10px] leading-[12px] text-primary/60 whitespace-pre z-0"
        aria-hidden="true"
      >
        {ASCII_BG}
      </motion.pre>

      {/* Foreground content */}
      <div className="relative z-10 px-6 py-16">
        <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/')} className="font-mono text-sm hover:bg-primary/20">
            <ChevronRight className="w-4 h-4 mr-1" /> BACK_TO_TERMINAL
          </Button>
          <div className="text-xs text-muted-foreground">
            CLI iOS-style command framer • 3 cards
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <CLIWindow {...content.project} />
          <CLIWindow {...content.concept} />
          <CLIWindow {...content.collaboration} />
        </div>
      </div>
    </div>
  );
}