import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * true si el usuario pidió "reducir movimiento" en su sistema
 * (iOS/Android: ajuste de accesibilidad; web: prefers-reduced-motion).
 * Se actualiza en vivo si el ajuste cambia con la app abierta.
 */
export function useReduceMotion(): boolean {
  const [reducir, setReducir] = useState(false);

  useEffect(() => {
    let activo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => {
        if (activo) setReducir(valor);
      })
      .catch(() => {});
    // En web, react-native-web puede devolver undefined si no hay matchMedia.
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducir) as
      | { remove: () => void }
      | undefined;
    return () => {
      activo = false;
      sub?.remove();
    };
  }, []);

  return reducir;
}
