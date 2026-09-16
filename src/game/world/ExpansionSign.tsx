import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three';

type ExpansionSignProps = {
  position: [number, number, number];
  label: string;
  width?: number;
};

/** A small painted wayfinding board for the expansion regions. */
export function ExpansionSign({ position, label, width = 3 }: ExpansionSignProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create expansion sign canvas');

    context.fillStyle = '#285943';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#F4E8CC';
    context.lineWidth = 12;
    context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    context.fillStyle = '#F4E8CC';
    context.font = 'bold 66px "Noto Sans", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const words = label.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > 900) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line || lines.length === 0) lines.push(line);
    const lineHeight = 76;
    const firstLine = 160 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((text, index) => context.fillText(text, canvas.width / 2, firstLine + index * lineHeight, 900));

    const painted = new CanvasTexture(canvas);
    painted.colorSpace = SRGBColorSpace;
    painted.needsUpdate = true;
    return painted;
  }, [label]);

  useEffect(() => () => texture.dispose(), [texture]);

  const boardHeight = width * 0.32;
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 2, 8]} />
        <meshStandardMaterial color="#6D4932" roughness={1} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[width, boardHeight, 0.12]} />
        <meshStandardMaterial map={texture} roughness={1} side={DoubleSide} />
      </mesh>
    </group>
  );
}
