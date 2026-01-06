"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";


export default function FamilyTree({ data }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data || !data.nodes || !data.edges) {
      return;
    }

    const graph = new Graph();

    data.nodes.forEach((node) => {
      graph.addNode(node.id, {
        ...node,
        x: Math.random(),
        y: Math.random(),
        size: node.size || 15,
        color: node.color || (node.gender === "male" ? "#3b82f6" : node.gender === "female" ? "#ec4899" : "#a0a0a0"),
      });
    });

    data.edges.forEach((edge) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          ...edge,
          type: "line",
          size: 3,
          color: edge.type === "couple" ? "#f472b6" : "#cbd5e1",
          label: edge.label || ""
        });
      } else {
        console.warn(`邊緣(${edge.source}-${edge.target})的一個或兩個節點不存在。`);
      }
    });

    forceAtlas2.assign(graph, { iterations: 100 });

    const renderer = new Sigma(graph, containerRef.current, {
      allowInvalidContainer: true,
      renderEdgeLabels: true,
      defaultEdgeColor: "#6b7280",
      defaultNodeColor: "#4f46e5",
      labelRenderedSizeThreshold: 5,
    });


    return () => {
      renderer.kill();
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "600px",
        backgroundColor: "#f3f4f6",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    />
  );
}