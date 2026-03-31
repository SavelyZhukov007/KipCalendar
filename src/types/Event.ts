export type Event = PlanEvent | TaskEvent;

interface BaseEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description: string;
  type: 'public' | 'private';
  name: string; // Уникальное имя для URL
}

export interface PlanEvent extends BaseEvent {
  eventType: 'plan';
  content?: string;
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:MM
  recurringOptions?: {
    days: number[];
    reminderType: 'same' | 'perDay';
    reminderTime: string | { [key: number]: string };
    endRepeat: string | null;
  };
  shared?: boolean;
  allowComments?: boolean;
}

export interface TaskEvent extends BaseEvent {
  eventType: 'task';
  subTasks?: Array<{
    name: string;
    description: string;
    deadline: string;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'inprogress' | 'completed';
  }>;
  shared?: boolean;
  allowComments?: boolean;
}