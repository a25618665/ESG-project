<?php
// OpenAI API endpoint and your API key
$url = 'https://api.openai.com/v1/chat/completions';
$api_key = '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';

// User input message
$user_input = 'Hello, how can I help you?';

// Prepare the data
$data = array(
    'model' => 'gpt-3.5-turbo',
    'messages' => array(
        array('role' => 'system', 'content' => 'You are a customer support agent.'),
        array('role' => 'user', 'content' => $user_input)
    )
);

// Send the API request
$headers = array(
    'Content-Type: application/json',
    'Authorization: Bearer ' . $api_key
);
$options = array(
    'http' => array(
        'header' => $headers,
        'method' => 'POST',
        'content' => json_encode($data)
    )
);
$context = stream_context_create($options);
$response = file_get_contents($url, false, $context);

// Parse the response
$result = json_decode($response, true);
$answer = $result['choices'][0]['message']['content'];

// Display the answer
echo $answer;
?>
