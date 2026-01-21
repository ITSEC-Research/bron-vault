declare module 'react-simple-maps' {
  import { ReactNode, SVGProps } from 'react'

  export interface Geography {
    rsmKey: string
    properties: {
      NAME?: string
      name?: string
      ISO_A3?: string
      ISO3?: string
      iso_a3?: string
      ISO_A2?: string
      ISO2?: string
      iso_a2?: string
      [key: string]: any
    }
    id?: string | number
    [key: string]: any
  }

  export interface GeographiesProps {
    geography: string | object
    children: (params: { geographies: Geography[] }) => ReactNode
  }

  export interface GeographyProps {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
    onClick?: (event: React.MouseEvent) => void
    onMouseEnter?: (event: React.MouseEvent) => void
    onMouseLeave?: (event: React.MouseEvent) => void
  }

  export interface ComposableMapProps {
    projectionConfig?: {
      scale?: number
      center?: [number, number]
    }
    style?: React.CSSProperties
    children?: ReactNode
  }

  export interface ZoomableGroupProps {
    zoom?: number
    center?: [number, number]
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void
    children?: ReactNode
  }

  export interface GraticuleProps {
    stroke?: string
    strokeWidth?: number
    strokeDasharray?: string
  }

  export const ComposableMap: React.FC<ComposableMapProps>
  export const Geographies: React.FC<GeographiesProps>
  export const Geography: React.FC<GeographyProps>
  export const ZoomableGroup: React.FC<ZoomableGroupProps>
  export const Graticule: React.FC<GraticuleProps>
}
