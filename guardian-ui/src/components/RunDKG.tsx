import {
  CircularProgress,
  Heading,
  Text,
  VStack,
  useTheme,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { useGuardianContext } from '../hooks';

interface Props {
  next(): void;
}

export const RunDKG: React.FC<Props> = ({ next }) => {
  const { api } = useGuardianContext();
  const theme = useTheme();
  const [error, setError] = useState<string>();

  // Keep trying to run DKG until it's finished, or we get an unexpected error.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const runDkg = () => {
      api
        .runDkg()
        .then(() => next())
        .catch((err) => {
          const message = err.message || err.toString();
          if (message === 'Dkg was already run') {
            next();
          } else if (message === 'Cannot run DKG now') {
            timeout = setTimeout(() => runDkg, 3000);
          } else {
            setError(message);
          }
        });
    };
    runDkg();
    return () => clearTimeout(timeout);
  }, [next]);

  return (
    <VStack gap={8} justify='center' align='center'>
      {error ? (
        <>
          <Heading color={theme.colors.red[500]}>Something went wrong.</Heading>
          <Text>{error}</Text>
        </>
      ) : (
        <>
          <CircularProgress isIndeterminate color='#23419F' size='200px' />
          <Heading>Generating codes...</Heading>
        </>
      )}
    </VStack>
  );
};