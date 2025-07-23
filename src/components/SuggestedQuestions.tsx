import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionSelect: (question: string) => void;
}

export function SuggestedQuestions({ questions, onQuestionSelect }: SuggestedQuestionsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          You might also want to ask:
        </span>
      </div>
      <div className="space-y-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="ghost"
            size="sm"
            onClick={() => onQuestionSelect(question)}
            className="h-auto p-2 justify-start text-left whitespace-normal"
          >
            {question}
          </Button>
        ))}
      </div>
    </Card>
  );
}