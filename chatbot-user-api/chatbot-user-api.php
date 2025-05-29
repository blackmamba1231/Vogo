<?php
/**
 * Plugin Name: Chatbot User API
 * Description: Adds an API route to check user login status.
 * Version: 1.0
 * Author: Your Name
 */

add_action('rest_api_init', function () {
    register_rest_route('chatbot/v1', '/user', [
        'methods'  => 'GET',
        'callback' => function () {
            if (is_user_logged_in()) {
                $user = wp_get_current_user();
                return [
                    'logged_in' => true,
                    'user_id'   => $user->ID,
                    'email'     => $user->user_email,
                    'name'      => $user->display_name,
                ];
            } else {
                return [ 'logged_in' => false ];
            }
        },
        'permission_callback' => '__return_true',
    ]);
});
