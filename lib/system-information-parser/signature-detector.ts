// Signature detector untuk System Information Parser

/**
 * Deteksi apakah file adalah binary file
 * Mencegah crash saat parsing binary files
 */
function isBinaryFile(content: string): boolean {
  // Check for null bytes (indikator binary file)
  if (content.includes('\0')) {
    return true;
  }
  
  // Check ratio of printable vs non-printable characters
  const printableChars = content.match(/[\x20-\x7E\n\r\t]/g)?.length || 0;
  const totalChars = content.length;
  
  // Jika kurang dari 80% printable characters, kemungkinan binary
  if (totalChars > 0 && printableChars / totalChars < 0.8) {
    return true;
  }
  
  return false;
}

/**
 * Deteksi stealer type berdasarkan signature unik
 * Signature diurutkan berdasarkan uniqueness
 * Early return untuk performa optimal
 */
export function detectStealerType(content: string, fileName: string): string {
  // Deteksi binary file terlebih dahulu
  if (isBinaryFile(content)) {
    return 'Generic'; // Skip binary files
  }
  
  // Normalize content untuk case-insensitive matching
  const lowerContent = content.toLowerCase();
  const lowerFileName = fileName.toLowerCase();
  
  // Priority 1: Signature yang sangat unik dan jarang overlap
  // Lumma - signature sangat unik
  if (lowerContent.includes('lummac2') || lowerContent.includes('lid:')) {
    return 'Lumma';
  }
  
  // ExelaStealer - signature unik dengan URL
  if (lowerContent.includes('t.me/exelastealer')) {
    return 'ExelaStealer';
  }
  
  // Astris - signature unik dengan build name
  if (lowerContent.includes('[general]') && lowerContent.includes('build: recaptcha-verify')) {
    return 'Astris';
  }
  
  // Atomic Mac - signature unik dengan macOS
  if (lowerContent.includes('productname:') && lowerContent.includes('macos')) {
    return 'Atomic Mac';
  }
  
  // CryptBot - signature dengan _Information.txt dan format spesifik
  if (lowerFileName.includes('_information.txt') || 
      (lowerContent.includes('os:') && lowerContent.includes('local date and time:') && lowerContent.includes('username (computername):'))) {
    return 'CryptBot';
  }
  
  // PredatorTheThief - signature dengan "Predator The Thief"
  if (lowerContent.includes('predator the thief') || lowerContent.includes('predatorthethief') || 
      (lowerContent.includes('predator') && lowerContent.includes('v3.0.0 release'))) {
    return 'PredatorTheThief';
  }
  
  // Raccoon - signature dengan "Build compile date" atau "User ID:"
  if (lowerContent.includes('build compile date') || lowerContent.includes('bot_id:') || 
      (lowerContent.includes('user id:') && lowerContent.includes('last seen:'))) {
    return 'Raccoon';
  }
  
  // RedLine/META - signature dengan "Build ID:" dan format spesifik
  if (lowerContent.includes('build id:') || 
      (lowerContent.includes('userinformation.txt') && lowerContent.includes('machinename:') && lowerContent.includes('hardwares:'))) {
    return 'RedLine/META';
  }
  
  // Rhadamanthys - signature dengan "Install Date:" dan "Traffic Name:"
  if (lowerContent.includes('install date:') && lowerContent.includes('traffic name:')) {
    return 'Rhadamanthys';
  }
  
  // RisePro - signature dengan "Build:" dan "MachineID:" atau format spesifik
  if ((lowerContent.includes('build:') && lowerContent.includes('machineid:')) ||
      (lowerContent.includes('information.txt') && lowerContent.includes('location:') && lowerContent.includes('[hardware]'))) {
    return 'RisePro';
  }
  
  // StealC - signature dengan "Network Info:" dan "System Summary:"
  if (lowerContent.includes('network info:') && lowerContent.includes('system summary:')) {
    return 'StealC';
  }
  
  // Stealerium - signature dengan "[IP]" dan "[Machine]"
  if (lowerContent.includes('[ip]') && lowerContent.includes('[machine]')) {
    return 'Stealerium';
  }
  
  // Vidar - signature dengan "Ip:" dan "Version:" atau format spesifik
  if ((lowerContent.includes('ip:') && lowerContent.includes('version:') && lowerContent.includes('information.txt')) ||
      (lowerContent.includes('information.txt') && lowerContent.includes('[hardware]') && lowerContent.includes('videocard:'))) {
    return 'Vidar';
  }
  
  // XFiles - signature dengan "Operation ID:"
  if (lowerContent.includes('operation id:') || 
      (lowerContent.includes('operation id:') && lowerContent.includes('cpu (processor):') && lowerContent.includes('gpu (display devices):'))) {
    return 'XFiles';
  }
  
  // Ailurophile - signature dengan "PC Type: Microsoft Windows" dan "Allowed Extensions:"
  if (lowerContent.includes('pc type: microsoft windows') && lowerContent.includes('allowed extensions:')) {
    return 'Ailurophile';
  }
  
  // ArechClientV2 - signature dengan "UserInformation.txt" dan format spesifik
  if (lowerContent.includes('userinformation.txt') || 
      (lowerContent.includes('filelocation:') && lowerContent.includes('current language:') && lowerContent.includes('hardwares:'))) {
    return 'ArechClientV2';
  }
  
  // Banshee - signature dengan "HWID:" dan "Log Date:" dan "Build Name:"
  if ((lowerContent.includes('hwid:') && lowerContent.includes('log date:') && lowerContent.includes('build name:')) ||
      (lowerContent.includes('system_information.txt') && lowerContent.includes('operation system:') && lowerContent.includes('macos'))) {
    return 'Banshee';
  }
  
  // DarkCrystal RAT - signature dengan "PC Name:" dan "Windows Server"
  if (lowerContent.includes('pc name:') && lowerContent.includes('windows server')) {
    return 'DarkCrystal RAT';
  }
  
  // Meduza - signature dengan "HWID:" dan "Build Name:" dan "UserInfo.txt"
  if ((lowerContent.includes('hwid:') && lowerContent.includes('build name:') && lowerContent.includes('userinfo.txt')) ||
      (lowerContent.includes('userinfo.txt') && lowerContent.includes('country code:') && lowerContent.includes('execute path:'))) {
    return 'Meduza';
  }
  
  // Noxty - signature dengan "User:" dan "Operating System:" dan "identification.txt"
  if ((lowerContent.includes('user:') && lowerContent.includes('operating system:') && lowerContent.includes('identification.txt')) ||
      (lowerContent.includes('identification.txt') && lowerContent.includes('uptime:') && lowerContent.includes('screenresolution:'))) {
    return 'Noxty';
  }
  
  // Phemedrone - signature dengan "Geolocation Data" dan "Hardware Info"
  if (lowerContent.includes('geolocation data') && lowerContent.includes('hardware info')) {
    return 'Phemedrone';
  }
  
  // RL Stealer - signature dengan "Operating system :" dan "PC user :"
  if (lowerContent.includes('operating system :') && lowerContent.includes('pc user :')) {
    return 'RL Stealer';
  }
  
  // Skalka - signature dengan "Operation System:" dan "Current JarFile Path:"
  if (lowerContent.includes('operation system:') && lowerContent.includes('current jarfile path:')) {
    return 'Skalka';
  }
  
  // Priority 2: Signature dengan kombinasi pattern
  // ExelaStealer - Windows systeminfo format
  if (lowerContent.includes('host name:') && 
      lowerContent.includes('os name:') && 
      lowerContent.includes('os version:')) {
    return 'ExelaStealer';
  }
  
  // Blank Grabber - Windows systeminfo lengkap
  if (lowerContent.includes('host name:') && 
      lowerContent.includes('system manufacturer:') &&
      lowerContent.includes('total physical memory:')) {
    return 'Blank Grabber';
  }
  
  // Generic fallback
  return 'Generic';
}

