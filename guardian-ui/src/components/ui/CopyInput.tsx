import {
  InputGroup,
  Input,
  Button,
  Icon,
  InputRightElement,
  useTheme,
} from '@chakra-ui/react';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ReactComponent as CopyIcon } from '../../assets/svgs/copy.svg';

export interface CopyInputProps {
  value: string;
  onCopy?(): void;
}

export const CopyInput: React.FC<CopyInputProps> = ({ value, onCopy }) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const theme = useTheme();

  const handleCopy = useCallback(() => {
    clearTimeout(timeoutRef.current);
    try {
      navigator.clipboard.writeText(value);
      setHasCopied(true);
      onCopy && onCopy();
    } catch (err) {
      setHasErrored(true);
    }
    timeoutRef.current = setTimeout(() => {
      setHasCopied(false);
      setHasErrored(false);
    }, 1000);
  }, [onCopy, value]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <InputGroup width='100%'>
      <Input readOnly value={value} width='100%' />
      <InputRightElement
        borderLeft={`1px solid ${theme.colors.border.input}`}
        width={100}
      >
        <Button
          variant='ghost'
          leftIcon={<Icon as={CopyIcon} />}
          onClick={handleCopy}
          borderTopLeftRadius={0}
          borderBottomLeftRadius={0}
        >
          {hasCopied ? 'Copied' : hasErrored ? 'Error' : 'Copy'}
        </Button>
      </InputRightElement>
    </InputGroup>
  );
};
