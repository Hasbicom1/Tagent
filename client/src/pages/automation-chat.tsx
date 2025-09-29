import { useEffect, useState } from 'react';
import { UnifiedChatInterface } from '@/components/chat/UnifiedChatInterface';
import { Card } from '@/components/ui/card';

export default function AutomationChat() {
  const [sessionId, setSessionId] = useState<string>('');
  const [browserView, setBrowserView] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sessionId') || '';
    setSessionId(sid);
  }, []);

  return (
    <div className="flex h-screen">
      <div className="w-1/2 flex flex-col border-r">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">AI Agent - 24 Hour Automation</h1>
          <p className="text-sm text-gray-500">Session: {sessionId}</p>
        </div>
        <div className="flex-1 p-0">
          <Card className="h-full rounded-none">
            <UnifiedChatInterface
              sessionId={sessionId}
              onScreenshot={(s) => setBrowserView(`data:image/png;base64,${s}`)}
            />
          </Card>
        </div>
      </div>

      <div className="w-1/2 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-700 text-white">
          <h2>Live Browser View</h2>
          <p className="text-sm text-gray-400">Agent automation in real-time</p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {browserView ? (
            <img src={browserView} alt="Browser automation" className="w-full h-auto border border-gray-700" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p>Browser view will appear here</p>
                <p className="text-sm">when agent starts working</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

