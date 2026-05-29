import { atom } from 'nanostores';

export interface AnnotationCapture {
  id: string;
  imageDataUrl: string;
  timestamp: number;
}

export const annotationCaptureStore = atom<AnnotationCapture | null>(null);

export function captureAnnotation(imageDataUrl: string) {
  const capture: AnnotationCapture = {
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    imageDataUrl,
    timestamp: Date.now(),
  };
  annotationCaptureStore.set(capture);
}

export function clearAnnotationCapture() {
  annotationCaptureStore.set(null);
}
