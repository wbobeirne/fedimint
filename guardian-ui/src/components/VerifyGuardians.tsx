import React from 'react';
import { FormControl, Input, VStack, Heading, Button } from '@chakra-ui/react';

interface Props {
  next(): void;
}

export const VerifyGuardians: React.FC<Props> = ({ next }) => {
  return (
    <VStack gap={2} align='start' justify='start'>
      <Heading size='lg'>Share your verification code</Heading>
      <Input value='def6d79f61b5487ed05ab7bfef0229ee' />
      <div />
      <div />
      <Heading size='lg'>Enter peer verification codes</Heading>
      <FormControl>
        <Input placeholder="Leader's verification code" />
      </FormControl>
      <Button onClick={next}>Verify</Button>
    </VStack>
  );
};
