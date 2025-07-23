import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface ConfidenceIndicatorProps {
  confidence: number;
  source?: string;
}

export function ConfidenceIndicator({ confidence, source }: ConfidenceIndicatorProps) {
  const getConfidenceLevel = () => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  const getIcon = () => {
    const level = getConfidenceLevel();
    switch (level) {
      case 'high':
        return <CheckCircle className="h-3 w-3" />;
      case 'medium':
        return <HelpCircle className="h-3 w-3" />;
      case 'low':
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  const getVariant = () => {
    const level = getConfidenceLevel();
    switch (level) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'destructive';
    }
  };

  const getLabel = () => {
    if (source === 'qa_database') return 'From FAQ';
    
    const level = getConfidenceLevel();
    switch (level) {
      case 'high':
        return 'High Confidence';
      case 'medium':
        return 'Medium Confidence';
      case 'low':
        return 'Low Confidence';
    }
  };

  return (
    <Badge variant={getVariant()} className="flex items-center gap-1 text-xs">
      {getIcon()}
      {getLabel()}
    </Badge>
  );
}