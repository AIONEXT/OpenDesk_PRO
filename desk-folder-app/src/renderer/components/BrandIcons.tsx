import React from 'react'

export const OpenDeskBrandIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <rect x="2" y="2" width="28" height="28" rx="7" fill="#0C1838" stroke="#268AE0" strokeWidth="1.8" />
    <path d="M6 9.5C6 8.67 6.67 8 7.5 8H13.5L15.2 10H24.5C25.33 10 26 10.67 26 11.5V22.5C26 23.33 25.33 24 24.5 24H7.5C6.67 24 6 23.33 6 22.5V9.5Z" fill="#1872DA" />
    <rect x="7.5" y="10.8" width="17" height="3" rx="1" fill="#BAE6FD" />
    <rect x="5.5" y="13" width="21" height="11" rx="2" fill="#38BDF8" />
    <rect x="5.5" y="13" width="21" height="1.6" rx="0.8" fill="#F0F9FF" />
    <path d="M16 14.8L20 16.2V19.2C20 21.3 18.2 22.9 16 23.6C13.8 22.9 12 21.3 12 19.2V16.2L16 14.8Z" fill="#0F2652" stroke="#F0FDFF" strokeWidth="1.2" />
    <circle cx="16" cy="18.3" r="1.2" fill="#67E8F9" />
    <rect x="15.4" y="18.8" width="1.2" height="2.4" rx="0.5" fill="#67E8F9" />
  </svg>
)

export const MacOSFolderIcon: React.FC<{ colorHex: string; size?: number }> = ({ colorHex, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 11C4 8.79086 5.79086 7 8 7H17.3431C18.404 7 19.4214 7.42143 20.1716 8.17157L22.8284 10.8284C23.5786 11.5786 24.596 12 25.6569 12H40C42.2091 12 44 13.7909 44 16V37C44 39.2091 42.2091 41 40 41H8C5.79086 41 4 39.2091 4 37V11Z"
      fill={colorHex}
      fillOpacity="0.82"
    />
    <path
      d="M4 17C4 15.3431 5.34315 14 7 14H41C42.6569 14 44 15.3431 44 17V37C44 39.2091 42.2091 41 40 41H8C5.79086 41 4 39.2091 4 37V17Z"
      fill={colorHex}
    />
    <path
      d="M4 17C4 15.3431 5.34315 14 7 14H41C42.6569 14 44 15.3431 44 17V18.5H4V17Z"
      fill="white"
      fillOpacity="0.28"
    />
  </svg>
)
