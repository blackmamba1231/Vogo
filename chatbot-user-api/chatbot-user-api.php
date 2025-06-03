<?php
/*
Plugin Name: Chatbot User API
Description: Provides user authentication status for the chatbot
Version: 2.8
Author: Vogo
*/

defined( 'ABSPATH' ) || exit;

/**
 * Ensure WordPress’s pluggable functions are loaded
 */
add_action( 'plugins_loaded', function() {
    if ( ! function_exists( 'wp_validate_auth_cookie' ) ) {
        require_once ABSPATH . WPINC . '/pluggable.php';
    }
}, 1 );

/**
 * Handle CORS preflight (OPTIONS) before REST routing kicks in
 */
add_action( 'init', function() {
    if ( $_SERVER['REQUEST_METHOD'] === 'OPTIONS'
      && strpos( $_SERVER['REQUEST_URI'], '/wp-json/chatbot/v1/user' ) !== false ) {

        $origin = get_http_origin();
        $allowed = [
            'http://localhost:3000',
            'https://vogo.family',
            'https://www.vogo.family',
        ];

        if ( in_array( $origin, $allowed, true ) ) {
            header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
            header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce' );
        }

        // End preflight here
        exit;
    }
}, 0 );

/**
 * Register the REST endpoint
 */
add_action( 'rest_api_init', function() {
    register_rest_route( 'chatbot/v1', '/user', [
        'methods'             => 'GET',
        'callback'            => 'chatbot_get_current_user',
        'permission_callback' => '__return_true',
    ] );
} );

/**
 * Returns the current user’s authentication status.
 *
 * @return array
 */
function chatbot_get_current_user() {
    $user_id = wp_validate_auth_cookie( '', 'logged_in' );
    if ( ! $user_id ) {
        return [
            'logged_in' => false,
            'error'     => 'Not logged in',
        ];
    }

    $user = get_userdata( $user_id );
    if ( ! $user ) {
        return [
            'logged_in' => false,
            'error'     => 'Invalid user',
        ];
    }

    return [
        'logged_in' => true,
        'user_id'   => $user->ID,
        'email'     => $user->user_email,
        'name'      => $user->display_name,
    ];
}

/**
 * Add CORS headers for actual GET request
 */
add_filter( 'rest_pre_serve_request', function( $served, $result, $request, $server ) {
    if ( $request->get_route() === '/chatbot/v1/user' ) {
        $origin = get_http_origin();
        $allowed = [
            'http://localhost:3000',
            'https://vogo.family',
            'https://www.vogo.family',
        ];

        if ( in_array( $origin, $allowed, true ) ) {
            header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
            header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce' );
        }
    }
    return $served;
}, 10, 4 );
