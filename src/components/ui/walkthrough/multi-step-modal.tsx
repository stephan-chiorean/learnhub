import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../dialog';
import { Button } from '../button';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from '../label';
import { Textarea } from '../textarea';
import { cn } from '../../../lib/utils';
import { SiOpenai } from 'react-icons/si';
import { useNavigate, useParams } from 'react-router-dom';

export type WalkthroughType = 'learning' | 'feature' | 'bug' | 'custom';
export type WalkthroughScope = 'whole' | 'folder' | 'file';
export type WalkthroughDepth = 'high' | 'mid' | 'low';
export type OutputFormat = 'narrative' | 'interactive' | 'diagram';

interface WalkthroughFormData {
  type: WalkthroughType;
  scope: WalkthroughScope;
  depth: WalkthroughDepth;
  context: string;
  outputFormat: OutputFormat;
  namespace: string;
}

interface MultiStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WalkthroughFormData) => void;
  namespace: string;
}

const steps = [
  { id: 'type', title: 'Select Type' },
  { id: 'scope', title: 'Select Scope' },
  { id: 'depth', title: 'Select Depth' },
  { id: 'context', title: 'Add Context' },
  { id: 'format', title: 'Select Format' },
];

const walkthroughTypes = [
  { value: 'learning', label: 'Learning / Exploratory' },
  { value: 'feature', label: 'Feature Crawl' },
  { value: 'bug', label: 'Bug / Issue Investigation' },
  { value: 'custom', label: 'Custom / Freeform' },
];

const scopes = [
  { value: 'whole', label: 'Whole Repository' },
  { value: 'folder', label: 'Specific Folder/Module' },
  { value: 'file', label: 'Single File/Component' },
];

const depths = [
  { value: 'high', label: 'High Level Only' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'low', label: 'Low Level' },
];

const outputFormats = [
  { value: 'narrative', label: 'Narrative Style' },
  { value: 'interactive', label: 'Interactive Step-through' },
  { value: 'diagram', label: 'Diagram + Notes' },
];

export const MultiStepModal: React.FC<MultiStepModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  namespace,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<WalkthroughFormData>({
    type: 'learning',
    scope: 'whole',
    depth: 'mid',
    context: '',
    outputFormat: 'narrative',
    namespace: namespace,
  });
  const navigate = useNavigate();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
    navigate(`/walkthrough/${owner}/${repo}`);
    onClose();
  };

  const updateFormData = (field: keyof WalkthroughFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => updateFormData('type', value as WalkthroughType)}
              className="space-y-4"
            >
              {walkthroughTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <RadioGroupItem value={type.value} id={type.value} className="border-orange-400 text-orange-600" />
                  <Label htmlFor={type.value} className="text-gray-700 font-medium">{type.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <RadioGroup
              value={formData.scope}
              onValueChange={(value) => updateFormData('scope', value as WalkthroughScope)}
              className="space-y-4"
            >
              {scopes.map((scope) => (
                <div key={scope.value} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <RadioGroupItem value={scope.value} id={scope.value} className="border-orange-400 text-orange-600" />
                  <Label htmlFor={scope.value} className="text-gray-700 font-medium">{scope.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <RadioGroup
              value={formData.depth}
              onValueChange={(value) => updateFormData('depth', value as WalkthroughDepth)}
              className="space-y-4"
            >
              {depths.map((depth) => (
                <div key={depth.value} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <RadioGroupItem value={depth.value} id={depth.value} className="border-orange-400 text-orange-600" />
                  <Label htmlFor={depth.value} className="text-gray-700 font-medium">{depth.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Add your goals, time constraints, or notes here..."
              value={formData.context}
              onChange={(e) => updateFormData('context', e.target.value)}
              className="min-h-[150px] bg-orange-50 border-orange-200 focus:border-orange-400 focus:ring-orange-400"
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <RadioGroup
              value={formData.outputFormat}
              onValueChange={(value) => updateFormData('outputFormat', value as OutputFormat)}
              className="space-y-4"
            >
              {outputFormats.map((format) => (
                <div key={format.value} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <RadioGroupItem value={format.value} id={format.value} className="border-orange-400 text-orange-600" />
                  <Label htmlFor={format.value} className="text-gray-700 font-medium">{format.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-orange-600 flex items-center gap-2">
            <SiOpenai className="w-5 h-5" />
            Configure Walkthrough
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex justify-between mb-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center",
                index < currentStep && "text-green-600",
                index === currentStep && "text-orange-600 font-medium"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                  index < currentStep && "bg-green-100",
                  index === currentStep && "bg-orange-100",
                  index > currentStep && "bg-gray-100"
                )}
              >
                {index + 1}
              </div>
              <span className="text-sm">{step.title}</span>
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="mb-6">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          >
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button 
              onClick={handleNext}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Start Walkthrough
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 