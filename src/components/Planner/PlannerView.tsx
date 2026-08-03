import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import type { WikiEntity } from '../../services/types';
import { 
  Users, 
  MapPin, 
  Sparkles, 
  BookOpen, 
  Plus, 
  Trash2, 
  Tag, 
  Info, 
  X,
  Edit,
  Map as MapIcon,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Paintbrush,
  Globe,
  PaintBucket,
  Eraser
} from 'lucide-react';
import L from 'leaflet';

export const PlannerView: React.FC = () => {
  const { entities, createEntity, deleteEntity, updateEntity } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'location' | 'item' | 'lore'>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Custom Map States
  const { activeProject } = useApp();
  const [mapType, setMapType] = useState<'earth' | 'fantasy'>(() => {
    if (!activeProject) return 'earth';
    return (localStorage.getItem(`map_type_${activeProject.id}`) as 'earth' | 'fantasy') || 'earth';
  });
  const [earthStyle, setEarthStyle] = useState<'dark' | 'satellite' | 'natgeo'>(() => {
    if (!activeProject) return 'dark';
    return (localStorage.getItem(`earth_style_${activeProject.id}`) as 'dark' | 'satellite' | 'natgeo') || 'dark';
  });
  const [mapName, setMapName] = useState(() => {
    if (!activeProject) return 'World Map';
    return localStorage.getItem(`map_name_${activeProject.id}`) || 'World Map';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPainterModal, setShowPainterModal] = useState(false);
  const [overlayTrigger, setOverlayTrigger] = useState(0);

  // Derive selectedEntity from entities list and ID state
  const selectedEntity = entities.find(e => e.id === selectedEntityId) || null;

  // Painter form states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#10b981'); // Emerald green
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'bucket' | 'stamp'>('brush');
  const [stampType, setStampType] = useState<'island' | 'continent' | 'ridge' | 'archipelago'>('island');

  // Creation form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState<WikiEntity | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WikiEntity['type']>('character');
  const [newDesc, setNewDesc] = useState('');
  
  // Custom properties for character/location
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [tempContent, setTempContent] = useState<Record<string, string>>({});

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  
  // Track leaflet overlay instances
  const activeTileLayer = useRef<L.TileLayer | null>(null);
  const activeImageOverlay = useRef<L.ImageOverlay | null>(null);

  const handleUpdateMapName = (name: string) => {
    setMapName(name);
    if (activeProject) {
      localStorage.setItem(`map_name_${activeProject.id}`, name);
    }
  };

  const handleUpdateMapType = (type: 'earth' | 'fantasy') => {
    setMapType(type);
    if (activeProject) {
      localStorage.setItem(`map_type_${activeProject.id}`, type);
    }
  };

  const handleUpdateEarthStyle = (style: 'dark' | 'satellite' | 'natgeo') => {
    setEarthStyle(style);
    if (activeProject) {
      localStorage.setItem(`earth_style_${activeProject.id}`, style);
    }
  };

  // Load image on Canvas mount inside the Painter modal
  useEffect(() => {
    if (showPainterModal && canvasRef.current && activeProject) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const savedData = localStorage.getItem(`map_canvas_${activeProject.id}`);
      if (savedData) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = savedData;
      } else {
        ctx.fillStyle = '#1e3a8a'; // Fills with deep water blue
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showPainterModal, activeProject]);

  // --- Canvas Drawing Algorithms & Helpers ---
  
  // High-frequency cosine & sine organic blob shape generator
  const drawBlobStamp = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const numPoints = 12;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = size * (0.7 + Math.sin(angle * 3) * 0.18 + Math.cos(angle * 5) * 0.1);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Mountain Ridge / Elongated organic path generator
  const drawRidgeStamp = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const numPoints = 16;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const factor = 0.5 + Math.sin(angle * 2) * 0.45 + Math.cos(angle * 6) * 0.12;
      const r = size * factor;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Stamped group of scattered organic islands
  const drawArchipelagoStamp = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => {
    drawBlobStamp(ctx, cx, cy, size * 0.45, color);
    
    const satellites = [
      [-size * 0.7, -size * 0.4],
      [size * 0.8, -size * 0.3],
      [-size * 0.2, size * 0.85],
      [size * 0.5, size * 0.65],
      [-size * 0.5, size * 0.2]
    ];
    
    satellites.forEach(([ox, oy]) => {
      const rx = cx + ox + (Math.random() - 0.5) * (size * 0.1);
      const ry = cy + oy + (Math.random() - 0.5) * (size * 0.1);
      drawBlobStamp(ctx, rx, ry, size * (0.12 + Math.random() * 0.15), color);
    });
  };

  // Fast Stack-based Queue Flood Fill for canvas
  const floodFill = (canvas: HTMLCanvasElement, startX: number, startY: number, fillColor: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const hex = fillColor.replace('#', '');
    const targetR = parseInt(hex.substring(0, 2), 16);
    const targetG = parseInt(hex.substring(2, 4), 16);
    const targetB = parseInt(hex.substring(4, 6), 16);
    const targetA = 255;

    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (startR === targetR && startG === targetG && startB === targetB && startA === targetA) {
      return;
    }

    const stack: number[] = [startX, startY];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const currY = stack.pop()!;
      const currX = stack.pop()!;
      
      const idx = currY * width + currX;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pos = idx * 4;
      if (
        Math.abs(data[pos] - startR) < 15 &&
        Math.abs(data[pos + 1] - startG) < 15 &&
        Math.abs(data[pos + 2] - startB) < 15 &&
        Math.abs(data[pos + 3] - startA) < 15
      ) {
        data[pos] = targetR;
        data[pos + 1] = targetG;
        data[pos + 2] = targetB;
        data[pos + 3] = targetA;

        if (currX > 0) { stack.push(currX - 1); stack.push(currY); }
        if (currX < width - 1) { stack.push(currX + 1); stack.push(currY); }
        if (currY > 0) { stack.push(currX); stack.push(currY - 1); }
        if (currY < height - 1) { stack.push(currX); stack.push(currY + 1); }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Preset Blueprint World Outlines Templates
  const handleLoadTemplate = (type: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (type === 'earth') {
      ctx.fillStyle = '#10b981';
      const drawPoly = (points: number[][]) => {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fill();
      };

      // North America
      drawPoly([
        [50, 100], [120, 80], [280, 80], [350, 60], [380, 120], [320, 160], 
        [310, 210], [280, 240], [270, 270], [230, 270], [210, 310], [200, 280], 
        [150, 220], [120, 180], [60, 130]
      ]);

      // Greenland
      drawPoly([
        [360, 60], [420, 50], [440, 80], [390, 110], [350, 90]
      ]);

      // South America
      drawPoly([
        [210, 310], [260, 310], [320, 320], [350, 350], [380, 380], 
        [340, 420], [290, 470], [275, 490], [265, 470], [250, 410], 
        [220, 360], [200, 330]
      ]);

      // Afro-Eurasia
      drawPoly([
        [470, 150], [520, 100], [600, 80], [700, 70], [800, 70], [900, 80], [920, 120],
        [890, 180], [840, 230], [800, 280], [765, 300], [755, 270],
        [710, 280], [715, 310], [690, 280], [650, 270], [635, 290], [610, 260],
        [590, 260], [635, 340], [610, 400], [580, 440], [565, 440], 
        [510, 345], [455, 290], [475, 240], [520, 235], [580, 240]
      ]);

      // Madagascar
      drawPoly([
        [620, 390], [635, 380], [625, 420], [615, 430]
      ]);

      // Australia
      drawPoly([
        [780, 360], [840, 340], [880, 360], [890, 400], [850, 430], [800, 420], [775, 390]
      ]);

      // New Zealand
      drawPoly([
        [910, 440], [920, 430], [915, 460]
      ]);

      // Antarctica
      ctx.fillRect(50, 475, 900, 15);
    } else if (type === 'pangaea') {
      drawBlobStamp(ctx, 500, 250, 200, '#10b981');
      drawBlobStamp(ctx, 400, 300, 110, '#10b981');
      drawBlobStamp(ctx, 620, 200, 130, '#10b981');
      drawBlobStamp(ctx, 350, 170, 90, '#10b981');
    } else if (type === 'ring') {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(500, 250, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(500, 250, 120, 0, Math.PI * 2);
      ctx.fill();
      drawBlobStamp(ctx, 500, 250, 45, '#10b981');
      drawBlobStamp(ctx, 460, 210, 25, '#10b981');
    } else if (type === 'archipelago') {
      for (let i = 0; i < 18; i++) {
        const rx = 100 + Math.random() * 800;
        const ry = 80 + Math.random() * 340;
        const rsize = 12 + Math.random() * 32;
        drawBlobStamp(ctx, rx, ry, rsize, '#10b981');
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    
    if (activeTool === 'bucket') {
      floodFill(canvas, x, y, brushColor);
      return;
    }

    if (activeTool === 'stamp') {
      const colorToStamp = brushColor;
      if (stampType === 'island') {
        drawBlobStamp(ctx, x, y, brushSize * 1.5, colorToStamp);
      } else if (stampType === 'continent') {
        drawBlobStamp(ctx, x, y, brushSize * 3.5, colorToStamp);
      } else if (stampType === 'ridge') {
        drawRidgeStamp(ctx, x, y, brushSize * 3, colorToStamp);
      } else if (stampType === 'archipelago') {
        drawArchipelagoStamp(ctx, x, y, brushSize * 2.5, colorToStamp);
      }
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool === 'bucket' || activeTool === 'stamp') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = activeTool === 'eraser' ? '#1e3a8a' : brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearPainterCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSavePainterCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeProject) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    localStorage.setItem(`map_canvas_${activeProject.id}`, dataUrl);
    
    setOverlayTrigger(prev => prev + 1);
    setShowPainterModal(false);
  };

  // Initialize and clean up Leaflet Map
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current) {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        activeTileLayer.current = null;
        activeImageOverlay.current = null;
      }
      return;
    }

    const map = L.map(mapRef.current, {
      doubleClickZoom: false
    }).setView([20, 0], 2);

    leafletMap.current = map;

    const handleDblClick = (e: L.LeafletMouseEvent) => {
      setEditingEntity(null);
      setNewName('');
      setNewType('location');
      setNewDesc('');
      setTempContent({
        lat: e.latlng.lat.toFixed(6),
        lng: e.latlng.lng.toFixed(6)
      });
      setShowAddForm(true);
    };

    map.on('dblclick', handleDblClick);

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.off('dblclick', handleDblClick);
      map.remove();
      leafletMap.current = null;
      activeTileLayer.current = null;
      activeImageOverlay.current = null;
    };
  }, [viewMode]);

  // Handle map resize when fullscreen toggles
  useEffect(() => {
    if (leafletMap.current) {
      setTimeout(() => {
        leafletMap.current?.invalidateSize();
      }, 300);
    }
  }, [isFullscreen]);

  // Synchronize Leaflet map layers (tile maps vs canvas overlays)
  useEffect(() => {
    const map = leafletMap.current;
    if (viewMode !== 'map' || !map || !activeProject) return;

    if (activeTileLayer.current) {
      activeTileLayer.current.remove();
      activeTileLayer.current = null;
    }

    if (activeImageOverlay.current) {
      activeImageOverlay.current.remove();
      activeImageOverlay.current = null;
    }

    if (mapType === 'earth') {
      let tileUrl = '';
      let attribution = '';
      
      if (earthStyle === 'dark') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      } else if (earthStyle === 'satellite') {
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      } else if (earthStyle === 'natgeo') {
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; National Geographic, DeLorme, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC';
      }

      const layer = L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 18
      }).addTo(map);

      activeTileLayer.current = layer;
    } else {
      const canvasData = localStorage.getItem(`map_canvas_${activeProject.id}`);
      
      if (canvasData) {
        const overlay = L.imageOverlay(canvasData, [[-90, -180], [90, 180]]).addTo(map);
        activeImageOverlay.current = overlay;
      } else {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 10;
        dummyCanvas.height = 5;
        const ctx = dummyCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(0, 0, 10, 5);
        }
        const overlay = L.imageOverlay(dummyCanvas.toDataURL(), [[-90, -180], [90, 180]]).addTo(map);
        activeImageOverlay.current = overlay;
      }
    }
  }, [viewMode, mapType, earthStyle, activeProject, overlayTrigger]);

  // Synchronize location pins on map when entities are updated
  useEffect(() => {
    const map = leafletMap.current;
    if (viewMode !== 'map' || !map) return;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    const locations = entities.filter(e => e.type === 'location');

    locations.forEach(loc => {
      const lat = parseFloat(loc.content?.lat);
      const lng = parseFloat(loc.content?.lng);
      
      if (isNaN(lat) || isNaN(lng)) return;

      const markerIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow-lg shadow-emerald-500/40 text-white transition-transform hover:scale-110 active:scale-95 duration-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
      });

      const marker = L.marker([lat, lng], {
        icon: markerIcon,
        draggable: true
      }).addTo(map);

      marker.bindPopup(`
        <div class="p-1 min-w-[120px] select-none text-slate-200">
          <div class="font-bold text-slate-100 text-sm truncate">${loc.name}</div>
          <div class="text-xs text-slate-400 mt-0.5 line-clamp-2">${loc.description || 'No description provided.'}</div>
          <div class="text-[10px] text-indigo-400 font-semibold mt-2.5 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 5v14"/></svg>
            Drag pin to move location
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedEntityId(loc.id);
      });

      marker.on('dragend', async (e) => {
        const newLatLng = e.target.getLatLng();
        const nextContent = {
          ...loc.content,
          lat: newLatLng.lat.toFixed(6),
          lng: newLatLng.lng.toFixed(6)
        };
        await updateEntity(loc.id, {
          content: nextContent
        });
      });

      markersRef.current[loc.id] = marker;
    });
  }, [entities, viewMode, updateEntity]);

  const handleAddProperty = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setTempContent(prev => ({
      ...prev,
      [newKey.trim()]: newVal.trim()
    }));
    setNewKey('');
    setNewVal('');
  };

  const handleRemoveProperty = (key: string) => {
    setTempContent(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let savedEntity: WikiEntity | void;
    if (editingEntity) {
      savedEntity = await updateEntity(editingEntity.id, {
        name: newName.trim(),
        type: newType,
        description: newDesc.trim(),
        content: tempContent
      });
      if (savedEntity) {
        setSelectedEntityId(savedEntity.id);
      }
    } else {
      await createEntity(
        newName.trim(),
        newType,
        newDesc.trim(),
        tempContent
      );
    }

    // Fly map to coordinates if we created/edited a location
    const lat = parseFloat(tempContent.lat);
    const lng = parseFloat(tempContent.lng);
    if (newType === 'location' && viewMode === 'map' && leafletMap.current && !isNaN(lat) && !isNaN(lng)) {
      leafletMap.current.flyTo([lat, lng], 6);
    }

    // Reset Form
    setNewName('');
    setNewType('character');
    setNewDesc('');
    setTempContent({});
    setEditingEntity(null);
    setShowAddForm(false);
  };

  const filteredEntities = activeTab === 'all' 
    ? entities 
    : entities.filter(e => e.type === activeTab);

  const getIcon = (type: WikiEntity['type']) => {
    switch (type) {
      case 'character': return <Users className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'item': return <Sparkles className="w-4 h-4" />;
      case 'lore': return <BookOpen className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: WikiEntity['type']) => {
    switch (type) {
      case 'character': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'location': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'item': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'lore': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="flex-1 flex h-screen bg-slate-900 overflow-hidden text-slate-300">
      
      {/* Main planner feed */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Planner Header */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">World Planner & Wiki</h2>
            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 text-xs">
              {(['all', 'character', 'location', 'item', 'lore'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md font-medium capitalize transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-200 text-slate-400'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-955 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-200 text-slate-400'}`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-200 text-slate-400'}`}
                title="Map View"
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setEditingEntity(null);
                setNewName('');
                setNewType('character');
                setNewDesc('');
                setTempContent({});
                setShowAddForm(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-lg shadow-indigo-600/15 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Entity
            </button>
          </div>
        </header>

        {/* Wiki Grid / Map View */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {viewMode === 'map' ? (
            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative ${isFullscreen ? 'map-fullscreen-view' : 'p-8'}`}>
              
              {/* Floating Settings HUD overlay (Premium overlay panel) */}
              <div className="absolute top-12 left-12 z-40 w-64 bg-slate-950/95 backdrop-blur-md border border-slate-850 rounded-xl p-4 flex flex-col gap-4 shadow-2xl select-none">
                
                {/* Map Name Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Map Title</label>
                  <input
                    type="text"
                    value={mapName}
                    onChange={(e) => handleUpdateMapName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none transition-colors font-semibold"
                    placeholder="Rename map..."
                  />
                </div>

                {/* Geography Mode Toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Geography Type</label>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleUpdateMapType('earth')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-colors ${mapType === 'earth' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Earth
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateMapType('fantasy')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md transition-colors ${mapType === 'fantasy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Fantasy Paint
                    </button>
                  </div>
                </div>

                {/* Earth styles dropdown */}
                {mapType === 'earth' && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-900 pt-3">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Map Style</label>
                    <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
                      {(['dark', 'satellite', 'natgeo'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => handleUpdateEarthStyle(style)}
                          className={`flex-1 py-1 rounded-md capitalize transition-colors ${earthStyle === style ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          {style === 'natgeo' ? 'NatGeo' : style}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paint button (Fantasy mode) */}
                {mapType === 'fantasy' && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-900 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowPainterModal(true)}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 rounded-lg shadow-lg shadow-emerald-600/10 transition-colors"
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Paint Land & Water
                    </button>
                  </div>
                )}

              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`absolute ${isFullscreen ? 'top-6 right-6' : 'top-12 right-12'} z-40 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-2.5 rounded-xl text-slate-400 hover:text-slate-200 shadow-2xl transition-all duration-150`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              >
                {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
              </button>

              <div className="flex-1 rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl relative min-h-0">
                <div ref={mapRef} className="absolute inset-0 z-10 w-full h-full" />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-8">
              {filteredEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Info className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-sm">No wiki entities found in this category.</p>
                  <button 
                    onClick={() => setShowAddForm(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2 underline"
                  >
                    Create your first note
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredEntities.map((ent) => (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntityId(ent.id)}
                      className={`group bg-slate-950/40 hover:bg-slate-950/85 border border-slate-800/80 rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:border-slate-700/80 hover:shadow-xl hover:shadow-black/15 ${selectedEntity?.id === ent.id ? 'ring-2 ring-indigo-500 border-transparent bg-slate-950' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getTypeColor(ent.type)}`}>
                            {getIcon(ent.type)}
                            {ent.type}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-100 group-hover:text-white text-base truncate mb-1">{ent.name}</h3>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-4">{ent.description || 'No description provided.'}</p>
                      </div>

                      {/* Quick metadata badges */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-900 pt-3 text-[11px] text-slate-500">
                        <span className="truncate flex-1">
                          Updated {new Date(ent.updated_at).toLocaleDateString()}
                        </span>
                        {Object.keys(ent.content).length > 0 && (
                          <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] border border-slate-800">
                            {Object.keys(ent.content).length} attributes
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Selected Entity Details Panel */}
      {selectedEntity && (
        <div className="w-80 border-l border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex flex-col h-full shrink-0 animate-in slide-in-from-right duration-200">
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 truncate text-sm">Entity Details</h3>
            <button 
              onClick={() => setSelectedEntityId(null)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-900 p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getTypeColor(selectedEntity.type)}`}>
                {getIcon(selectedEntity.type)}
                {selectedEntity.type}
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-2">{selectedEntity.name}</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-slate-900">{selectedEntity.description || 'No description provided.'}</p>
            </div>

            {/* Map Coordinates for Locations */}
            {selectedEntity.type === 'location' && (
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 flex flex-col gap-1 text-xs">
                <span className="text-emerald-400 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Map Placement
                </span>
                {selectedEntity.content?.lat !== undefined && selectedEntity.content?.lng !== undefined ? (
                  <div className="text-slate-300 mt-1 flex justify-between font-mono text-[10px]">
                    <span>Lat: {selectedEntity.content.lat}</span>
                    <span>Lng: {selectedEntity.content.lng}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic mt-1 text-[11px]">Not placed on map. Edit or double-click on map to set coordinates.</span>
                )}
              </div>
            )}

            {/* Custom attributes section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Attributes</h4>
              {Object.entries(selectedEntity.content).filter(([k]) => k !== 'lat' && k !== 'lng').length === 0 ? (
                <div className="text-xs text-slate-500 italic">No structured attributes logged.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(selectedEntity.content)
                    .filter(([key]) => key !== 'lat' && key !== 'lng')
                    .map(([key, val]) => (
                      <div key={key} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-0.5 text-xs">
                        <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">{key}</span>
                        <span className="text-slate-200">{String(val)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-t border-slate-900 bg-slate-950 flex items-center gap-3">
            <button
              onClick={() => {
                setEditingEntity(selectedEntity);
                setNewName(selectedEntity.name);
                setNewType(selectedEntity.type);
                setNewDesc(selectedEntity.description || '');
                setTempContent(selectedEntity.content || {});
                setShowAddForm(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800/80 text-slate-300 text-xs font-semibold transition-all duration-150"
            >
              <Edit className="w-3.5 h-3.5 text-indigo-400" />
              Edit Entity
            </button>
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ${selectedEntity.name}?`)) {
                  await deleteEntity(selectedEntity.id);
                  setSelectedEntityId(null);
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold transition-all duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Entity
            </button>
          </div>
        </div>
      )}

      {/* Add Entity Slide-over / Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" />
                {editingEntity ? 'Edit World Entity' : 'Add World Entity'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setEditingEntity(null);
                }}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1 rounded-md transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entity Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Lyra Vance, Spire of Whispers"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entity Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as WikiEntity['type'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="character">Character</option>
                    <option value="location">Location</option>
                    <option value="item">Item</option>
                    <option value="lore">Lore</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Short Summary</label>
                <textarea
                  placeholder="A quick summary of this entity..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                />
              </div>

              {newType === 'location' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 51.5074"
                      value={tempContent.lat || ''}
                      onChange={(e) => setTempContent(prev => ({ ...prev, lat: e.target.value }))}
                      className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. -0.1278"
                      value={tempContent.lng || ''}
                      onChange={(e) => setTempContent(prev => ({ ...prev, lng: e.target.value }))}
                      className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>
              )}

              {/* Attributes Builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Structured Attributes (Optional)</label>
                
                {/* Properties list */}
                {Object.keys(tempContent).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    {Object.entries(tempContent).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1 bg-slate-905 border border-slate-800 text-[10px] text-slate-300 pl-2.5 pr-1.5 py-1 rounded-md font-medium">
                        <span className="text-slate-500 font-semibold">{key}:</span>
                        <span className="text-slate-200">{String(val)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProperty(key)}
                          className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 rounded ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Properties inputs */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Age, Region)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 24, Stormpeaks)"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddProperty}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingEntity(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-colors"
                >
                  {editingEntity ? 'Update Entity' : 'Save Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Land Painter Modal Overlay */}
      {showPainterModal && (
        <div className="fixed inset-0 bg-slate-955/90 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-850 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <header className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Interactive Land Painter</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Draw or stamp custom geography. Save to overlay it directly onto your interactive map.</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setShowPainterModal(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </header>

            <div className="flex-1 flex min-h-0 overflow-hidden">
              
              {/* Sidebar tools */}
              <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col justify-between shrink-0">
                <div className="space-y-4">
                  
                  {/* Tool Mode Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Drawing Tool</label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setActiveTool('brush')}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${activeTool === 'brush' ? 'bg-slate-900 border-indigo-500/50 text-slate-200' : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900/30'}`}
                      >
                        <Paintbrush className="w-4 h-4 text-indigo-400" />
                        Brush
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTool('eraser')}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${activeTool === 'eraser' ? 'bg-slate-900 border-indigo-500/50 text-slate-200' : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900/30'}`}
                      >
                        <Eraser className="w-4 h-4 text-rose-400" />
                        Eraser
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTool('bucket')}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${activeTool === 'bucket' ? 'bg-slate-900 border-indigo-500/50 text-slate-200' : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900/30'}`}
                        title="Fill closed area"
                      >
                        <PaintBucket className="w-4 h-4 text-sky-400" />
                        Fill Bucket
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTool('stamp')}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${activeTool === 'stamp' ? 'bg-slate-900 border-indigo-500/50 text-slate-200' : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900/30'}`}
                        title="Click to stamp shapes"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Stamps
                      </button>
                    </div>
                  </div>

                  {/* Stamp shape grid (only shown if stamp is active) */}
                  {activeTool === 'stamp' && (
                    <div className="space-y-1.5 border-t border-slate-900 pt-3 animate-in slide-in-from-top-1 duration-100">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Preset Shape</label>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                        {[
                          { id: 'island', label: 'Island' },
                          { id: 'continent', label: 'Continent' },
                          { id: 'ridge', label: 'Ridge' },
                          { id: 'archipelago', label: 'Archipelago' }
                        ].map((stamp) => (
                          <button
                            key={stamp.id}
                            type="button"
                            onClick={() => setStampType(stamp.id as 'island' | 'continent' | 'ridge' | 'archipelago')}
                            className={`py-2 rounded-lg border text-center transition-colors ${stampType === stamp.id ? 'bg-slate-900 border-indigo-500/50 text-slate-200 font-bold' : 'bg-transparent border-slate-800 text-slate-400 hover:bg-slate-900/30'}`}
                          >
                            {stamp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Precision Brush Size Range Slider */}
                  <div className="space-y-1.5 border-t border-slate-900 pt-3">
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      <span>Brush Size</span>
                      <span className="text-slate-350 font-mono">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="120"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Geography Color swatches */}
                  <div className="space-y-2 border-t border-slate-900 pt-3">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Geography Color</label>
                    <div className="space-y-2">
                      {[
                        { name: 'Deep Ocean', color: '#1e3a8a', desc: 'Fills deep waters' },
                        { name: 'Shallow Coast', color: '#3b82f6', desc: 'Reefs & shores' },
                        { name: 'Grassland (Land)', color: '#10b981', desc: 'Main landmass' },
                        { name: 'Desert / Sand', color: '#f59e0b', desc: 'Beaches & deserts' },
                        { name: 'Mountains', color: '#b45309', desc: 'Highlands & peaks' }
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => {
                            setBrushColor(item.color);
                          }}
                          className={`w-full flex items-center gap-3 p-1.5 rounded-lg border text-left text-xs transition-colors font-medium ${brushColor === item.color ? 'bg-slate-900 border-indigo-500/50 text-slate-200 font-bold' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-350'}`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ backgroundColor: item.color }} />
                          <div className="flex flex-col gap-0.5">
                            <span>{item.name}</span>
                            <span className="text-[9px] opacity-60 font-normal">{item.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template outlines loader dropdown */}
                  <div className="space-y-1.5 border-t border-slate-900 pt-3">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Map Blueprint Template</label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          if (confirm(`Load template? This will erase your current custom map drawing.`)) {
                            handleLoadTemplate(e.target.value);
                          }
                          e.target.value = ''; // Reset select
                        }
                      }}
                      defaultValue=""
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-600 font-semibold cursor-pointer"
                    >
                      <option value="" disabled>Load Blueprint Outline...</option>
                      <option value="earth">Earth Silhouette Outline</option>
                      <option value="pangaea">Pangaea Supercontinent</option>
                      <option value="archipelago">Island Archipelago</option>
                      <option value="ring">Ring World Continent</option>
                    </select>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={handleClearPainterCanvas}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Fill Entire Map with Water
                </button>
              </div>

              {/* Canvas viewport */}
              <div className="flex-1 bg-slate-955 p-6 flex items-center justify-center min-h-0 overflow-hidden relative">
                <div className="painter-canvas-container rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50 shadow-2xl relative w-[1000px] h-[500px] shrink-0 max-w-full max-h-full">
                  <canvas
                    ref={canvasRef}
                    width={1000}
                    height={500}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-full block bg-slate-900"
                  />
                </div>
              </div>

            </div>

            <footer className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPainterModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-250 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSavePainterCanvas}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/25 transition-colors"
              >
                Apply Custom Geography
              </button>
            </footer>

          </div>
        </div>
      )}

    </div>
  );
};
