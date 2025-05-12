export function log(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
  console.log(`[${level}] ${new Date().toISOString()} - ${message}`);
}