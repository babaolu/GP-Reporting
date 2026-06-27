import { useState, useEffect } from 'react';
import { getChurchName } from '../lib/church-name';

export function useChurchName(): string {
  const [name, setName] = useState<string>(getChurchName);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      setName(custom.detail);
    };
    window.addEventListener('churchNameChanged', handler);
    return () => window.removeEventListener('churchNameChanged', handler);
  }, []);

  return name;
}
