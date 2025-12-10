"use client";
import React from 'react';

interface Point { x: number; y: number }

interface RelationshipLineProps {
  start: Point;
  end: Point;
  isTemp?: boolean;
  onDelete?: () => void;
}

export const RelationshipLine: React.FC<RelationshipLineProps> = ({ start, end, isTemp = false, onDelete }) => {
  if (!start || !end) return null;

  // S-Shape Connector Logic (Bézier Curve)
  const dist = Math.abs(end.x - start.x);
  const controlOffset = Math.max(dist * 0.5, 50);
  
  // Cubic Bezier Path
  const path = `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;

  // Calculate approximate midpoint for the delete button (t=0.5)
  const p0x = start.x, p0y = start.y;
  const p1x = start.x + controlOffset, p1y = start.y;
  const p2x = end.x - controlOffset, p2y = end.y;
  const p3x = end.x, p3y = end.y;

  const buttonX = (p0x + 3 * p1x + 3 * p2x + p3x) / 8;
  const buttonY = (p0y + 3 * p1y + 3 * p2y + p3y) / 8;

  if (isTemp) {
    return (
      <path 
        d={path} 
        stroke="#60a5fa" 
        strokeWidth="2" 
        strokeDasharray="5,5"
        fill="none"
        className="pointer-events-none" 
      />
    );
  }

  return (
    <g className="group pointer-events-auto">
      {/* 1. Visible Line */}
      <path 
        d={path} 
        stroke="#475569" 
        strokeWidth="2" 
        fill="none" 
        className="transition-colors group-hover:stroke-blue-400"
      />
      
      {/* 2. Invisible Hit Area (Thicker) */}
      <path 
        d={path} 
        stroke="transparent" 
        strokeWidth="20" 
        fill="none" 
        className="cursor-pointer"
      />

      {/* 3. Delete Button (Visible on Hover) */}
      {onDelete && (
        <g 
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <circle cx={buttonX} cy={buttonY} r="10" className="fill-slate-900 stroke-red-500 stroke-1 shadow-sm" />
          <path 
            transform={`translate(${buttonX-4}, ${buttonY-4})`} 
            d="M2.5 2.5l3 3m0-3l-3 3" 
            stroke="#ef4444" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
          />
          {/* Extended hit area for the button */}
          <circle cx={buttonX} cy={buttonY} r="15" fill="transparent" />
        </g>
      )}

      {/* Endpoints */}
      <circle cx={start.x} cy={start.y} r="3" className="fill-slate-500 group-hover:fill-blue-400" />
      <circle cx={end.x} cy={end.y} r="3" className="fill-slate-500 group-hover:fill-blue-400" />
    </g>
  );
};