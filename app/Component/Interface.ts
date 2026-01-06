
interface NodeData {
  id: string;
  label: string;
  gender?: string;
  birthYear?: number;
  color?: string; 
  size?: number; 
}

interface EdgeData {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

interface FamilyTreeProps {
  data: {
    nodes: NodeData[];
    edges: EdgeData[];
  };
}