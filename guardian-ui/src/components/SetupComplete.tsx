import React from 'react';
import { Image, Heading, Text, Box } from '@chakra-ui/react';

export const SetupComplete: React.FC = () => {
  return (
    <>
      <Image src='https://pleb.fi/pleb.jpg' boxSize={250} />
      <Box mt={5} />
      <Heading mb={2}>Whoa there traveler!</Heading>
      <Text>
        I'm sorry, your federation has been taken over by a covenant. Better
        luck next time, kiddo.
      </Text>
    </>
  );
};
