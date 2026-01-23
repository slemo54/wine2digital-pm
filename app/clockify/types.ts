export type TimeEntry = {
  project: string;
  client: string;
  description: string;
  task: string;
  kiosk: string;
  user: string;
  group: string;
  email: string;
  tags: string[];
  billable: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  durationH: string;
  durationDecimal: number;
  createdAtDate: string;
};

