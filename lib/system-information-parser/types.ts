// TypeScript interfaces untuk System Information Parser

export interface ParsedLogData {
  stealerType: string;
  os: string | null;
  ipAddress: string | null;
  username: string | null;
  cpu: string | null;
  ram: string | null;
  computerName: string | null;
  gpu: string | null;
  country: string | null;
  logDate: string | null;
  logTime?: string | null;  // Format: HH:mm:ss (optional untuk backward compatibility)
  hwid: string | null;
  filePath: string | null;
  antivirus: string | null;
}

export interface SystemInfoFile {
  fileName: string;
  content: string;
}

export type ParserFunction = (
  content: string,
  fileName: string
) => ParsedLogData;

