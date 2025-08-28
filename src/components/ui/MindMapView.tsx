import React, { useEffect, useRef, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { ChatSession, Bookmark } from '../../types';

interface MindMapViewProps {
  chats: ChatSession[];
  bookmarks: Bookmark[];
  onChatClick?: (chatId: string) => void;
  onBookmarkClick?: (bookmarkId: string, chatId: string) => void;
}

export default function MindMapView({ chats, bookmarks, onChatClick, onBookmarkClick }: MindMapViewProps) {
  const cyRef = useRef<any>(null);

  // Generate Cytoscape elements from chat and bookmark data
  const elements = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];

    // Add chat nodes
    chats.forEach((chat) => {
      const chatBookmarks = bookmarks.filter(b => b.chatSessionId === chat.id);
      nodes.push({
        data: {
          id: `chat-${chat.id}`,
          label: chat.title.length > 20 ? chat.title.substring(0, 20) + '...' : chat.title,
          type: 'chat',
          chatId: chat.id,
          bookmarkCount: chatBookmarks.length
        }
      });

      // Add bookmark nodes and edges
      chatBookmarks.forEach((bookmark) => {
        nodes.push({
          data: {
            id: `bookmark-${bookmark.id}`,
            label: bookmark.title.length > 15 ? bookmark.title.substring(0, 15) + '...' : bookmark.title,
            type: 'bookmark',
            bookmarkId: bookmark.id,
            chatId: bookmark.chatSessionId
          }
        });

        // Add edge from chat to bookmark
        edges.push({
          data: {
            id: `edge-${chat.id}-${bookmark.id}`,
            source: `chat-${chat.id}`,
            target: `bookmark-${bookmark.id}`
          }
        });
      });
    });

    return [...nodes, ...edges];
  }, [chats, bookmarks]);

  // Cytoscape stylesheet
  const stylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': '#fff',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000',
        'font-size': '12px',
        'font-weight': 'bold',
        'text-wrap': 'wrap',
        'text-max-width': '80px',
        'width': '60px',
        'height': '60px',
        'border-width': '2px',
        'border-color': '#000',
        'cursor': 'pointer'
      }
    },
    {
      selector: 'node[type="chat"]',
      style: {
        'background-color': '#000',
        'color': '#fff',
        'width': '80px',
        'height': '80px',
        'font-size': '14px',
        'border-color': '#000'
      }
    },
    {
      selector: 'node[type="bookmark"]',
      style: {
        'background-color': '#fff',
        'color': '#000',
        'width': '50px',
        'height': '50px',
        'font-size': '10px',
        'border-color': '#000'
      }
    },
    {
      selector: 'node:hover',
      style: {
        'border-width': '4px',
        'border-opacity': 0.8
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1,
        'line-color': '#000',
        'target-arrow-color': '#000',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier'
      }
    },
    {
      selector: 'edge:hover',
      style: {
        'line-color': '#666',
        'target-arrow-color': '#666',
        'width': 2
      }
    }
  ];

  // Layout configuration for force-directed graph
  const layout = {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    nodeRepulsion: 400000,
    nodeOverlap: 10,
    idealEdgeLength: 100,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  };

  // Handle node clicks
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      
      cy.on('tap', 'node', (event: any) => {
        const node = event.target;
        const data = node.data();
        
        if (data.type === 'chat' && onChatClick) {
          onChatClick(data.chatId);
        } else if (data.type === 'bookmark' && onBookmarkClick) {
          onBookmarkClick(data.bookmarkId, data.chatId);
        }
      });

      // Apply layout after mounting
      cy.layout(layout).run();
    }
  }, [onChatClick, onBookmarkClick, elements]);

  return (
    <div className="w-full h-full bg-gray-50 relative">
      {elements.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-6xl mb-4">🕸️</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Network to Display</h3>
            <p className="text-gray-500">Start creating chats and bookmarks to see the network graph!</p>
          </div>
        </div>
      ) : (
        <>
          <CytoscapeComponent
            elements={elements}
            style={{ width: '100%', height: '100%' }}
            stylesheet={stylesheet}
            layout={layout}
            cy={(cy) => {
              cyRef.current = cy;
            }}
            boxSelectionEnabled={false}
            autoungrabify={false}
            autounselectify={false}
          />
          
          {/* Control Panel */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
            <button
              onClick={() => cyRef.current?.fit()}
              className="block w-full px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Fit to View
            </button>
            <button
              onClick={() => cyRef.current?.center()}
              className="block w-full px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Center
            </button>
            <button
              onClick={() => cyRef.current?.layout(layout).run()}
              className="block w-full px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Re-layout
            </button>
          </div>

          {/* Info Panel */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-black">
            <div className="flex items-center space-x-4 text-xs text-black">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-black rounded-full"></div>
                <span>Chats ({chats.length})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-white border border-black rounded-full"></div>
                <span>Bookmarks ({bookmarks.length})</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              💡 Drag nodes • Click to navigate • Scroll to zoom
            </div>
          </div>
        </>
      )}
    </div>
  );
}