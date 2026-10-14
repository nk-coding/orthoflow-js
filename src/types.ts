// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Ported from d2layouts/d2talalayout/internal/graphjson/representation.go
// (terrastruct/d2, Copyright 2022 Terrastruct Inc.).
// TypeScript port: Copyright 2026 Niklas Krieger.

/**
 * Entity (node/edge) ID: a signed 64-bit integer. D2 uses 63-bit hash IDs,
 * which do not fit into a JS number; such IDs are `bigint`s (see
 * {@link LayoutOptions.bigint}). IDs that are safe integers are numbers.
 */
export type EntityID = number | bigint;

/** A point (`{x, y}`). */
export interface Point {
  x: number;
  y: number;
}

/** D2 label positions (`lib/label`). `""` in an input lets the layout choose. */
export type LabelPosition =
  | 'OUTSIDE_TOP_LEFT'
  | 'OUTSIDE_TOP_CENTER'
  | 'OUTSIDE_TOP_RIGHT'
  | 'OUTSIDE_LEFT_TOP'
  | 'OUTSIDE_LEFT_MIDDLE'
  | 'OUTSIDE_LEFT_BOTTOM'
  | 'OUTSIDE_RIGHT_TOP'
  | 'OUTSIDE_RIGHT_MIDDLE'
  | 'OUTSIDE_RIGHT_BOTTOM'
  | 'OUTSIDE_BOTTOM_LEFT'
  | 'OUTSIDE_BOTTOM_CENTER'
  | 'OUTSIDE_BOTTOM_RIGHT'
  | 'INSIDE_TOP_LEFT'
  | 'INSIDE_TOP_CENTER'
  | 'INSIDE_TOP_RIGHT'
  | 'INSIDE_MIDDLE_LEFT'
  | 'INSIDE_MIDDLE_CENTER'
  | 'INSIDE_MIDDLE_RIGHT'
  | 'INSIDE_BOTTOM_LEFT'
  | 'INSIDE_BOTTOM_CENTER'
  | 'INSIDE_BOTTOM_RIGHT'
  | 'BORDER_TOP_LEFT'
  | 'BORDER_TOP_CENTER'
  | 'BORDER_TOP_RIGHT'
  | 'BORDER_LEFT_TOP'
  | 'BORDER_LEFT_MIDDLE'
  | 'BORDER_LEFT_BOTTOM'
  | 'BORDER_RIGHT_TOP'
  | 'BORDER_RIGHT_MIDDLE'
  | 'BORDER_RIGHT_BOTTOM'
  | 'BORDER_BOTTOM_LEFT'
  | 'BORDER_BOTTOM_CENTER'
  | 'BORDER_BOTTOM_RIGHT'
  | 'UNLOCKED_TOP'
  | 'UNLOCKED_MIDDLE'
  | 'UNLOCKED_BOTTOM';

/** D2 shape types (`lib/shape`). Unknown names (and `""`) behave like `Square`. */
export type ShapeType =
  | ''
  | 'Square'
  | 'RealSquare'
  | 'Parallelogram'
  | 'Document'
  | 'Cylinder'
  | 'Queue'
  | 'Page'
  | 'Package'
  | 'Step'
  | 'Callout'
  | 'StoredData'
  | 'Person'
  | 'C4Person'
  | 'Diamond'
  | 'Oval'
  | 'Circle'
  | 'Hexagon'
  | 'Cloud'
  | 'Table'
  | 'Class'
  | 'Text'
  | 'Code'
  | 'Image';

/** D2 arrowhead names (`d2target`); `""` means none. */
export type Arrowhead =
  | ''
  | 'none'
  | 'arrow'
  | 'triangle'
  | 'unfilled-triangle'
  | 'diamond'
  | 'filled-diamond'
  | 'circle'
  | 'filled-circle'
  | 'cross'
  | 'box'
  | 'filled-box'
  | 'line'
  | 'cf-one'
  | 'cf-one-required'
  | 'cf-many'
  | 'cf-many-required';

/** Label geometry (`SerializedLabel`). */
export interface Label {
  Text: string;
  /** `""` (input: let the layout choose) or a {@link LabelPosition}. */
  Position: LabelPosition | '' | (string & {});
  Width: number;
  Height: number;
}

/** Icon placement (`SerializedIcon`). */
export interface Icon {
  Position: LabelPosition | '' | (string & {});
}

/** One D2 style value (`SerializedScalar`). */
export interface StyleScalar {
  value: string;
}

/** Edge style (`SerializedStyle`). */
export interface EdgeStyle {
  opacity?: StyleScalar;
  stroke?: StyleScalar;
  fill?: StyleScalar;
  fillPattern?: StyleScalar;
  strokeWidth?: StyleScalar;
  strokeDash?: StyleScalar;
  borderRadius?: StyleScalar;
  shadow?: StyleScalar;
  '3d'?: StyleScalar;
  multiple?: StyleScalar;
  font?: StyleScalar;
  fontSize?: StyleScalar;
  fontColor?: StyleScalar;
  animated?: StyleScalar;
  bold?: StyleScalar;
  italic?: StyleScalar;
  underline?: StyleScalar;
  filled?: StyleScalar;
  doubleBorder?: StyleScalar;
  textTransform?: StyleScalar;
}

/** A node (`SerializedNode`). */
export interface Node {
  id: EntityID;
  d2id?: string;
  isInvisible?: boolean;
  width: number;
  height: number;
  /** `null` in an input; the position after layout. */
  topLeft: Point | null;
  fixedTopLeft?: Point;
  desiredWidth?: number;
  desiredHeight?: number;
  nears?: EntityID[];
  fontSize?: number | null;
  shapeType: ShapeType | (string & {});
  label?: Label;
  icon?: Icon;
  numColumns?: number;
  is3D?: boolean;
  isMultiple?: boolean;
  forceHierarchy?: boolean;
}

/** An edge (`SerializedEdge`). */
export interface Edge {
  id: EntityID;
  /** Original edge ID when `id` is a serialization-only reference. */
  originalId?: EntityID;
  d2id?: string;
  from: EntityID;
  isInvisible?: boolean;
  to: EntityID;
  /** `[]` in an input; the orthogonal route after layout. */
  points: Point[];
  minWidth?: number;
  minHeight?: number;
  /** Position of the label along the route (output). */
  labelPercentage?: number;
  label?: Label;
  fromTableColumnIndex?: number;
  toTableColumnIndex?: number;
  style?: EdgeStyle;
  sourceArrowhead: Arrowhead | (string & {});
  targetArrowhead: Arrowhead | (string & {});
  sourceArrowheadLabel?: Label;
  targetArrowheadLabel?: Label;
}

/** Temporary grouping endpoints of an edge (`SerializedEdgeAbduction`). */
export interface EdgeAbduction {
  Edge: EntityID;
  OriginallyFromNode: EntityID;
  OriginallyToNode: EntityID;
  CurrentFromNode: EntityID;
  CurrentToNode: EntityID;
}

/** A cluster (`SerializedCluster`; engine state). */
export interface Cluster {
  Nodes: EntityID[];
  Arrangement: string;
  DesiredArrangement: string;
  EdgeAbductions: EdgeAbduction[] | null;
  Container: EntityID;
  FixedSize: boolean;
  Padding: number;
}

/** A sequence (`SerializedSequence`; engine state). */
export interface Sequence {
  Nodes: EntityID[];
  EdgeAbductions: EdgeAbduction[] | null;
  Container: EntityID;
}

/** A layout tree (`SerializedTree`; engine state). */
export interface Tree {
  Node: Node;
  Children: Tree[] | null;
  SentinelEdge: Edge;
  Orientation: number;
}

/** Node ranks of one hierarchy (`SerializedHierarchy`; engine state). */
export interface Hierarchy {
  /** Node ID (as a decimal string) to level. */
  Levels: Record<string, number>;
}

/**
 * A graph in TALA's graphjson format (`SerializedGraph`). Map keys are entity
 * IDs written as decimal strings; `"0"` in `containers` is the root.
 *
 * Inputs need `nodes`, `edges` and usually `containers`; the other fields are
 * engine state written by the layout (leave them out or use `0`/`{}`).
 */
export interface Graph {
  nodes: Node[];
  edges: Edge[];
  CellSize?: number;
  isRootHierarchy?: boolean;
  /** Container node ID → child node IDs; `"0"` is the root container. */
  containers?: Record<string, EntityID[]>;
  hubs?: Record<string, EntityID[]>;
  clusters?: Record<string, Cluster>;
  sequences?: Record<string, Sequence>;
  clusterVessels?: Record<string, Node>;
  sequenceVessels?: Record<string, Node>;
  trees?: Record<string, Tree[]>;
  hierarchies?: Hierarchy[];
  /** Container node ID → layout direction. */
  directions?: Record<string, 'up' | 'down' | 'left' | 'right' | (string & {})>;
  crossingCost?: number;
  turnCost?: number;
  nonCenterPortCost?: number;
}

/** A node after layout: `topLeft` is set. */
export interface LaidOutNode extends Node {
  topLeft: Point;
}

/** A laid-out graph. */
export interface LaidOutGraph extends Graph {
  nodes: LaidOutNode[];
  containers: Record<string, EntityID[]>;
  CellSize: number;
  crossingCost: number;
  turnCost: number;
  nonCenterPortCost: number;
}

/** Outcome of one seed. A failed seed has `error` instead of the scores. */
export interface SeedReport {
  seed: number | bigint;
  /** Quality penalty (lower is better). */
  penalty?: number;
  /** Area of the drawing. */
  area?: number;
  error?: string;
}

/** Result of {@link layout}: per-seed scores, the selected seed and its graph. */
export interface LayoutResult {
  seeds: SeedReport[];
  /** The selected seed, or `null` if every seed failed. */
  bestSeed: number | bigint | null;
  /** The laid-out graph of the selected seed, or `null` if every seed failed. */
  graph: LaidOutGraph | null;
}
