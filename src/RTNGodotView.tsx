import type { ViewProps } from 'react-native';

export type RTNGodotViewProps = ViewProps & {
  windowName?: string;
  onSurfaceReady?: () => void;
};

export function RTNGodotView(_props: RTNGodotViewProps): never {
  throw new Error(
    "'@preeternal/react-native-godot' is only supported on native platforms."
  );
}
