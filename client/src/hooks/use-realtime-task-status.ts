import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient, WSConnectionState, WSEventMap } from '@/lib/websocket';
import { SubscriptionType } from '@shared/websocket-types';
import { useToast } from '@/hooks/use-toast';

// Task status types matching the backend
export interface TaskStatus {
  taskId: string;
  sessionId: string;
  agentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taskType: string;
  progress?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TaskProgress {
  taskId: string;
  sessionId: string;
  progress: number;
  stage?: string;
  estimatedTimeRemaining?: number;
  timestamp: string;
}

export interface TaskLogs {
  taskId: string;
  sessionId: string;
  logs: string[];
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
}

export interface TaskError {
  taskId: string;
  sessionId: string;
  error: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  connectionState: WSConnectionState;
  lastConnected?: Date;
  reconnectAttempts: number;
}

// Hook for managing realtime task status updates
export function useRealtimeTaskStatus(agentId?: string, sessionId?: string) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isAuthenticated: false,
    connectionState: WSConnectionState.DISCONNECTED,
    reconnectAttempts: 0
  });

  const [taskStatuses, setTaskStatuses] = useState<Map<string, TaskStatus>>(new Map());
  const [taskProgress, setTaskProgress] = useState<Map<string, TaskProgress>>(new Map());
  const [taskLogs, setTaskLogs] = useState<Map<string, TaskLogs[]>>(new Map());
  const [taskErrors, setTaskErrors] = useState<Map<string, TaskError[]>>(new Map());
  
  const activeSubscriptions = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Initialize WebSocket connection
  const connect = useCallback(async () => {
    try {
      if (!agentId) return;

      await wsClient.connect();
      await wsClient.authenticate(agentId, agentId); // Use agentId as session token per system design

      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        isAuthenticated: true,
        connectionState: WSConnectionState.AUTHENTICATED,
        lastConnected: new Date(),
        reconnectAttempts: 0
      }));

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        isAuthenticated: false,
        connectionState: WSConnectionState.ERROR,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));

      toast({
        title: "Connection Error",
        description: "Failed to establish real-time connection. Using fallback mode.",
        variant: "destructive",
      });
    }
  }, [agentId, toast]);

  // Subscribe to task updates
  const subscribeToTask = useCallback(async (taskId: string) => {
    try {
      if (!wsClient.isReady()) {
        console.warn('WebSocket not ready, cannot subscribe to task:', taskId);
        return;
      }

      const subscriptionKey = `task:${taskId}`;
      if (activeSubscriptions.current.has(subscriptionKey)) {
        return; // Already subscribed
      }

      await wsClient.subscribe(SubscriptionType.TASK, taskId);
      activeSubscriptions.current.add(subscriptionKey);
      
      console.log('Subscribed to task updates:', taskId);
    } catch (error) {
      console.error('Failed to subscribe to task:', taskId, error);
    }
  }, []);

  // Subscribe to session updates
  const subscribeToSession = useCallback(async (sessionId: string) => {
    try {
      if (!wsClient.isReady()) {
        console.warn('WebSocket not ready, cannot subscribe to session:', sessionId);
        return;
      }

      const subscriptionKey = `session:${sessionId}`;
      if (activeSubscriptions.current.has(subscriptionKey)) {
        return; // Already subscribed
      }

      await wsClient.subscribe(SubscriptionType.SESSION, sessionId);
      activeSubscriptions.current.add(subscriptionKey);
      
      console.log('Subscribed to session updates:', sessionId);
    } catch (error) {
      console.error('Failed to subscribe to session:', sessionId, error);
    }
  }, []);

  // Subscribe to agent updates
  const subscribeToAgent = useCallback(async (agentId: string) => {
    try {
      if (!wsClient.isReady()) {
        console.warn('WebSocket not ready, cannot subscribe to agent:', agentId);
        return;
      }

      const subscriptionKey = `agent:${agentId}`;
      if (activeSubscriptions.current.has(subscriptionKey)) {
        return; // Already subscribed
      }

      await wsClient.subscribe(SubscriptionType.AGENT, agentId);
      activeSubscriptions.current.add(subscriptionKey);
      
      console.log('Subscribed to agent updates:', agentId);
    } catch (error) {
      console.error('Failed to subscribe to agent:', agentId, error);
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!agentId) return;

    // Connection status handlers
    const handleConnected = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        connectionState: WSConnectionState.CONNECTED,
        lastConnected: new Date()
      }));
    };

    const handleDisconnected = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        isAuthenticated: false,
        connectionState: WSConnectionState.DISCONNECTED
      }));
      // Clear active subscriptions on disconnect
      activeSubscriptions.current.clear();
    };

    const handleAuthenticated = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isAuthenticated: true,
        connectionState: WSConnectionState.AUTHENTICATED
      }));

      // Auto-subscribe to agent and session if available
      if (agentId) {
        subscribeToAgent(agentId);
      }
      if (sessionId) {
        subscribeToSession(sessionId);
      }
    };

    // Task event handlers
    const handleTaskStatus = (data: WSEventMap['taskStatus']) => {
      setTaskStatuses(prev => new Map(prev.set(data.taskId, data)));
    };

    const handleTaskProgress = (data: WSEventMap['taskProgress']) => {
      setTaskProgress(prev => new Map(prev.set(data.taskId, data)));
    };

    const handleTaskLogs = (data: WSEventMap['taskLogs']) => {
      setTaskLogs(prev => {
        const existing = prev.get(data.taskId) || [];
        return new Map(prev.set(data.taskId, [...existing, data]));
      });
    };

    const handleTaskError = (data: WSEventMap['taskError']) => {
      setTaskErrors(prev => {
        const existing = prev.get(data.taskId) || [];
        return new Map(prev.set(data.taskId, [...existing, data]));
      });
    };

    const handleError = (data: WSEventMap['error']) => {
      console.error('WebSocket error:', data);
      toast({
        title: "Real-time Error",
        description: data.error,
        variant: "destructive",
      });
    };

    // Register event listeners
    wsClient.on('connected', handleConnected);
    wsClient.on('disconnected', handleDisconnected);
    wsClient.on('authenticated', handleAuthenticated);
    wsClient.on('taskStatus', handleTaskStatus);
    wsClient.on('taskProgress', handleTaskProgress);
    wsClient.on('taskLogs', handleTaskLogs);
    wsClient.on('taskError', handleTaskError);
    wsClient.on('error', handleError);

    // Initial connection
    connect();

    // Cleanup
    return () => {
      wsClient.off('connected', handleConnected);
      wsClient.off('disconnected', handleDisconnected);
      wsClient.off('authenticated', handleAuthenticated);
      wsClient.off('taskStatus', handleTaskStatus);
      wsClient.off('taskProgress', handleTaskProgress);
      wsClient.off('taskLogs', handleTaskLogs);
      wsClient.off('taskError', handleTaskError);
      wsClient.off('error', handleError);
    };
  }, [agentId, sessionId, connect, subscribeToAgent, subscribeToSession, toast]);

  // Get task status by ID
  const getTaskStatus = useCallback((taskId: string): TaskStatus | undefined => {
    return taskStatuses.get(taskId);
  }, [taskStatuses]);

  // Get task progress by ID
  const getTaskProgress = useCallback((taskId: string): TaskProgress | undefined => {
    return taskProgress.get(taskId);
  }, [taskProgress]);

  // Get task logs by ID
  const getTaskLogs = useCallback((taskId: string): TaskLogs[] => {
    return taskLogs.get(taskId) || [];
  }, [taskLogs]);

  // Get task errors by ID
  const getTaskErrors = useCallback((taskId: string): TaskError[] => {
    return taskErrors.get(taskId) || [];
  }, [taskErrors]);

  // Get all task statuses for the session
  const getAllTaskStatuses = useCallback((): TaskStatus[] => {
    return Array.from(taskStatuses.values()).filter(status => 
      !sessionId || status.sessionId === sessionId
    );
  }, [taskStatuses, sessionId]);

  // Clear task data
  const clearTaskData = useCallback((taskId: string) => {
    setTaskStatuses(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    setTaskProgress(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    setTaskLogs(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    setTaskErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    wsClient.disconnect();
    activeSubscriptions.current.clear();
    setConnectionStatus({
      isConnected: false,
      isAuthenticated: false,
      connectionState: WSConnectionState.DISCONNECTED,
      reconnectAttempts: 0
    });
  }, []);

  return {
    // Connection management
    connectionStatus,
    connect,
    disconnect,
    
    // Subscription management
    subscribeToTask,
    subscribeToSession,
    subscribeToAgent,
    
    // Data access
    getTaskStatus,
    getTaskProgress,
    getTaskLogs,
    getTaskErrors,
    getAllTaskStatuses,
    clearTaskData,
    
    // Raw data for advanced usage
    taskStatuses: Array.from(taskStatuses.values()),
    taskProgress: Array.from(taskProgress.values()),
    allTaskLogs: taskLogs,
    allTaskErrors: taskErrors
  };
}