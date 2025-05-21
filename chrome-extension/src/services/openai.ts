import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

export const isDistraction = async (title: string): Promise<boolean> => {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Based on the title, decide if it is a distraction.' },
      { role: 'user', content: title },
    ],
    functions: [
      {
        name: 'is_distraction',
        description: 'Determines whether the given title is a distraction',
        parameters: {
          type: 'object',
          properties: {
            distraction: { type: 'boolean', description: 'True if title is a distraction' },
          },
          required: ['distraction'],
        },
      },
    ],
    // force the model to call our function exactly
    function_call: { name: 'is_distraction' },
  });

  // The model returns arguments as a JSON string in .message.arguments
  const args = JSON.parse(response.choices[0].message.arguments ?? '{}') as { distraction: boolean };

  return args.distraction;
};

// const _ = {
//   isDistraction,
// };

// export default _;
