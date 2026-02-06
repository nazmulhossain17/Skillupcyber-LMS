// ============================================
// FILE: components/courses/QuizPlayer.tsx
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ClipboardList, 
  Clock, 
  Target, 
  RotateCcw, 
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface QuizQuestion {
  id: string;
  question: string;
  questionType: string;
  options: string[] | unknown;
  points: number;
  order: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  questionCount: number;
}

interface PreviousAttempt {
  id: string;
  score: number | null;
  totalPoints: number | null;
  passed: boolean | null;
  status: string;
  completedAt: string | null;
}

type QuizState = 'intro' | 'playing' | 'results';

interface QuizResults {
  score: number;
  totalPoints: number;
  passed: boolean;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
}

interface QuizPlayerProps {
  quiz: Quiz | null;
  courseSlug: string;
  sectionTitle?: string;
}

export function QuizPlayer({ quiz, courseSlug, sectionTitle }: QuizPlayerProps) {
  // Quiz state
  const [quizState, setQuizState] = useState<QuizState>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  
  // Quiz info state (to get actual question count)
  const [actualQuestionCount, setActualQuestionCount] = useState<number>(0);
  const [previousAttempts, setPreviousAttempts] = useState<PreviousAttempt[]>([]);
  const [bestAttempt, setBestAttempt] = useState<PreviousAttempt | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(0);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  
  // Results state
  const [results, setResults] = useState<QuizResults | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch previous attempts on mount
  useEffect(() => {
    if (quiz?.id && courseSlug) {
      fetchPreviousAttempts();
    }
  }, [quiz?.id, courseSlug]);

  const fetchPreviousAttempts = async () => {
    if (!quiz || !courseSlug) return;
    
    setLoadingAttempts(true);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/quizzes/${quiz.id}/attempt`);
      if (res.ok) {
        const data = await res.json();
        setPreviousAttempts(data.attempts || []);
        setBestAttempt(data.bestAttempt || null);
        setAttemptsRemaining(data.attemptsRemaining ?? quiz.maxAttempts);
        
        // If we got question count from attempts API, use it
        if (data.quiz?.questionCount) {
          setActualQuestionCount(data.quiz.questionCount);
        }
      }
    } catch (error) {
      console.error('Failed to fetch attempts:', error);
    } finally {
      setLoadingAttempts(false);
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerActive && timeRemaining !== null && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setTimerActive(false);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  const handleTimeUp = async () => {
    toast.warning('Time is up! Submitting your quiz...');
    await submitQuiz();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start quiz
  const startQuiz = async () => {
    if (!quiz || !courseSlug) {
      toast.error('Quiz or course information is missing');
      return;
    }
    
    if (attemptsRemaining <= 0) {
      toast.error('No attempts remaining');
      return;
    }
    
    setLoading(true);
    try {
      // Start attempt
      const attemptRes = await fetch(
        `/api/courses/${courseSlug}/quizzes/${quiz.id}/attempt`,
        { method: 'POST' }
      );
      
      if (!attemptRes.ok) {
        const error = await attemptRes.json();
        throw new Error(error.error || 'Failed to start quiz');
      }
      
      const attemptData = await attemptRes.json();
      setAttemptId(attemptData.attempt.id);
      
      // Get questions
      const questionsRes = await fetch(
        `/api/courses/${courseSlug}/quizzes/${quiz.id}/questions`
      );
      
      if (!questionsRes.ok) {
        throw new Error('Failed to load questions');
      }
      
      const questionsData = await questionsRes.json();
      const fetchedQuestions = questionsData.questions || [];
      setQuestions(fetchedQuestions);
      setActualQuestionCount(fetchedQuestions.length);
      
      // Set timer if there's a time limit
      if (quiz.timeLimit) {
        setTimeRemaining(quiz.timeLimit * 60);
        setTimerActive(true);
      }
      
      setQuizState('playing');
      setCurrentQuestionIndex(0);
      setAnswers({});
      setSelectedAnswer(null);
    } catch (error) {
      console.error('Failed to start quiz:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start quiz');
    } finally {
      setLoading(false);
    }
  };

  // Handle answer selection
  const handleAnswerSelect = (answer: string) => {
    if (submitting) return;
    setSelectedAnswer(answer);
  };

  // Go to next question
  const nextQuestion = () => {
    if (selectedAnswer === null) {
      toast.error('Please select an answer');
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: selectedAnswer,
    }));
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(answers[questions[currentQuestionIndex + 1]?.id] || null);
    }
  };

  // Go to previous question
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      if (selectedAnswer !== null) {
        const currentQuestion = questions[currentQuestionIndex];
        setAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: selectedAnswer,
        }));
      }
      
      setCurrentQuestionIndex((prev) => prev - 1);
      const prevQuestionId = questions[currentQuestionIndex - 1]?.id;
      setSelectedAnswer(answers[prevQuestionId] || null);
    }
  };

  // Submit quiz
  const submitQuiz = async () => {
    if (!quiz || !attemptId || !courseSlug) return;
    
    const finalAnswers = { ...answers };
    if (selectedAnswer !== null) {
      const currentQuestion = questions[currentQuestionIndex];
      finalAnswers[currentQuestion.id] = selectedAnswer;
    }
    
    const unanswered = questions.filter((q) => !finalAnswers[q.id]);
    if (unanswered.length > 0 && timeRemaining !== 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }
    
    setSubmitting(true);
    setTimerActive(false);
    
    try {
      const res = await fetch(
        `/api/courses/${courseSlug}/quizzes/${quiz.id}/attempt/${attemptId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: finalAnswers }),
        }
      );
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit quiz');
      }
      
      const data = await res.json();
      
      let correctCount = 0;
      let wrongCount = 0;
      
      if (data.results && typeof data.results === 'object') {
        const resultsArray = Object.values(data.results) as Array<{ correct: boolean }>;
        correctCount = resultsArray.filter(r => r.correct === true).length;
        wrongCount = resultsArray.filter(r => r.correct === false).length;
      }
      
      const totalQuestions = correctCount + wrongCount;
      
      setResults({
        score: data.attempt?.score ?? 0,
        totalPoints: data.attempt?.totalPoints ?? 0,
        passed: data.attempt?.passed ?? false,
        percentage: data.percentage ?? 0,
        correctCount,
        wrongCount,
        totalQuestions,
      });
      
      setQuizState('results');
      
      // Refresh attempts
      fetchPreviousAttempts();
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  // Retry quiz
  const retryQuiz = () => {
    setQuizState('intro');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswers({});
    setAttemptId(null);
    setTimeRemaining(null);
    setTimerActive(false);
    setResults(null);
  };

  // Parse options helper
  const parseOptions = (options: unknown): string[] => {
    if (Array.isArray(options)) {
      return options.map(o => String(o));
    }
    if (typeof options === 'string') {
      try {
        const parsed = JSON.parse(options);
        if (Array.isArray(parsed)) {
          return parsed.map(o => String(o));
        }
      } catch {
        return [];
      }
    }
    return [];
  };

  // Get display question count
  const displayQuestionCount = actualQuestionCount || quiz?.questionCount || 0;

  // Render: No Quiz
  if (!quiz) {
    return (
      <div className="w-full h-full bg-linear-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Quiz Available</h3>
            <p className="text-gray-300 text-sm">This section doesn't have a quiz yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render: Intro Screen
  if (quizState === 'intro') {
    const hasCompletedAttempt = previousAttempts.some(a => a.status === 'completed');
    const canRetake = attemptsRemaining > 0;
    
    return (
      <div className="w-full h-full bg-linear-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <Card className="max-w-2xl w-full shadow-2xl border-0">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ClipboardList className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Quiz Assessment</p>
                <h2 className="text-xl sm:text-2xl font-bold">{quiz.title}</h2>
              </div>
            </div>

            {quiz.description && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-gray-700 text-sm leading-relaxed">{quiz.description}</p>
              </div>
            )}

            {/* Previous Best Score */}
            {bestAttempt && bestAttempt.score !== null && (
              <div className={`mb-6 p-4 rounded-xl border-2 ${
                bestAttempt.passed 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bestAttempt.passed ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <Trophy className={`h-5 w-5 ${bestAttempt.passed ? 'text-green-600' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${bestAttempt.passed ? 'text-green-800' : 'text-amber-800'}`}>
                      {bestAttempt.passed ? 'Quiz Passed!' : 'Previous Attempt'}
                    </p>
                    <p className={`text-sm ${bestAttempt.passed ? 'text-green-600' : 'text-amber-600'}`}>
                      Best Score: {bestAttempt.score}/{bestAttempt.totalPoints} 
                      ({bestAttempt.totalPoints ? Math.round((bestAttempt.score / bestAttempt.totalPoints) * 100) : 0}%)
                    </p>
                  </div>
                  {bestAttempt.passed && (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  )}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-linear-to-br from-blue-50 to-blue-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-blue-600 font-medium">Questions</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {loadingAttempts ? '...' : displayQuestionCount}
                </p>
              </div>

              <div className="p-4 bg-linear-to-br from-green-50 to-green-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-green-600 font-medium">Passing Score</p>
                </div>
                <p className="text-2xl font-bold text-green-900">{quiz.passingScore}%</p>
              </div>

              <div className="p-4 bg-linear-to-br from-amber-50 to-amber-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="text-xs text-amber-600 font-medium">Time Limit</p>
                </div>
                <p className="text-xl font-bold text-amber-900">
                  {quiz.timeLimit ? `${quiz.timeLimit} min` : 'No limit'}
                </p>
              </div>

              <div className="p-4 bg-linear-to-br from-purple-50 to-purple-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="h-4 w-4 text-purple-600" />
                  <p className="text-xs text-purple-600 font-medium">Attempts Left</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {loadingAttempts ? '...' : `${attemptsRemaining}/${quiz.maxAttempts}`}
                </p>
              </div>
            </div>

            {/* Start/Retake Button */}
            <Button 
              className={`w-full ${canRetake ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
              size="lg"
              onClick={startQuiz}
              disabled={loading || loadingAttempts || !canRetake}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading Quiz...
                </>
              ) : !canRetake ? (
                <>
                  <XCircle className="mr-2 h-5 w-5" />
                  No Attempts Remaining
                </>
              ) : hasCompletedAttempt ? (
                <>
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Retake Quiz
                </>
              ) : (
                <>
                  Start Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            {/* Attempts History */}
            {previousAttempts.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-gray-600 mb-3">Attempt History</p>
                <div className="space-y-2">
                  {previousAttempts.slice(0, 3).map((attempt, index) => (
                    <div 
                      key={attempt.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <span className="text-gray-600">Attempt {previousAttempts.length - index}</span>
                      <div className="flex items-center gap-3">
                        <span className={attempt.passed ? 'text-green-600' : 'text-red-600'}>
                          {attempt.score ?? 0}/{attempt.totalPoints ?? 0}
                        </span>
                        {attempt.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render: Playing
  if (quizState === 'playing') {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    
    if (!currentQuestion) {
      return (
        <div className="w-full h-full bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      );
    }
    
    const options = parseOptions(currentQuestion.options);
    
    return (
      <div className="w-full h-full bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <ClipboardList className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm sm:text-base">{quiz.title}</h3>
                <p className="text-gray-400 text-xs">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
            </div>

            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                timeRemaining < 60 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'
              }`}>
                <Clock className="h-4 w-4" />
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>

          <div className="max-w-4xl mx-auto mt-3">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-linear-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-full mb-4">
                <span className="text-purple-300 text-sm font-medium">
                  Question {currentQuestionIndex + 1}
                </span>
                <span className="text-purple-400 text-xs">
                  • {currentQuestion.points} point{currentQuestion.points > 1 ? 's' : ''}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 leading-relaxed">
                {currentQuestion.question}
              </h2>

              <div className="space-y-3">
                {options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const optionLetter = String.fromCharCode(65 + index);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      disabled={submitting}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSelected ? 'bg-purple-500 text-white' : 'bg-white/10 text-gray-400'
                      }`}>
                        {optionLetter}
                      </div>
                      <span className="text-sm sm:text-base">{option}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-purple-400 ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-black/30 backdrop-blur-sm border-t border-white/10 px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0 || submitting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="hidden sm:flex items-center gap-1">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (selectedAnswer !== null) {
                      setAnswers((prev) => ({
                        ...prev,
                        [questions[currentQuestionIndex].id]: selectedAnswer,
                      }));
                    }
                    setCurrentQuestionIndex(index);
                    setSelectedAnswer(answers[questions[index].id] || null);
                  }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentQuestionIndex
                      ? 'bg-purple-500 scale-125'
                      : answers[questions[index]?.id]
                        ? 'bg-green-500'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <Button
                onClick={submitQuiz}
                disabled={submitting || selectedAnswer === null}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Quiz
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={nextQuestion}
                disabled={selectedAnswer === null || submitting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render: Results
  if (quizState === 'results' && results) {
    const isPassed = results.passed;
    const displayCorrect = results.correctCount || 0;
    const displayWrong = results.wrongCount || 0;
    const displayTotal = results.totalQuestions || (displayCorrect + displayWrong) || questions.length;
    const displayPercentage = results.percentage || 0;
    
    return (
      <div className="w-full h-full bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-lg w-full">
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 text-center relative overflow-hidden">
            {isPassed && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <Sparkles className="absolute top-4 left-4 h-6 w-6 text-yellow-400/30 animate-pulse" />
                <Sparkles className="absolute top-8 right-8 h-4 w-4 text-purple-400/30 animate-pulse" />
                <Sparkles className="absolute bottom-12 left-8 h-5 w-5 text-green-400/30 animate-pulse" />
                <Star className="absolute top-16 left-1/4 h-3 w-3 text-yellow-400/20 animate-pulse" />
                <Star className="absolute bottom-20 right-1/4 h-4 w-4 text-pink-400/20 animate-pulse" />
              </div>
            )}

            <div className="relative mb-6">
              <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center ${
                isPassed ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {isPassed ? (
                  <CheckCircle2 className="h-6 w-6 text-white" />
                ) : (
                  <XCircle className="h-6 w-6 text-white" />
                )}
              </div>

              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke={isPassed ? '#22c55e' : '#ef4444'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(displayPercentage / 100) * 553} 553`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-white">
                    {displayCorrect}
                  </span>
                  <span className="text-2xl text-gray-400">/ {displayTotal}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className={`text-3xl font-bold mb-2 ${isPassed ? 'text-green-400' : 'text-red-400'}`}>
                {isPassed ? 'Great Job!' : 'Keep Trying!'}
              </h2>
              <p className="text-gray-300">
                {isPassed 
                  ? `You passed with ${displayCorrect} correct answers!`
                  : `You scored ${displayPercentage}%. You need ${quiz.passingScore}% to pass.`
                }
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-white">{displayPercentage}%</p>
                <p className="text-xs text-gray-400">Score</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-400">{displayCorrect}</p>
                <p className="text-xs text-gray-400">Correct</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-red-400">{displayWrong}</p>
                <p className="text-xs text-gray-400">Wrong</p>
              </div>
            </div>

            <div className="flex gap-3">
              {attemptsRemaining > 0 && (
                <Button
                  variant="outline"
                  onClick={retryQuiz}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              <Button
                onClick={() => setQuizState('intro')}
                className={`${attemptsRemaining > 0 ? 'flex-1' : 'w-full'} bg-purple-600 hover:bg-purple-700`}
              >
                Back to Quiz
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}