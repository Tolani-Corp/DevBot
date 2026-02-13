import React from 'react';

const styles = {
    body: {
        backgroundColor: '#f4f4f5', // Zinc-100
        fontFamily: '"SF Mono", "Segoe UI Mono", "Roboto Mono", monospace', // Tech font
        margin: 0,
        padding: 0,
        width: '100%',
    },
    container: {
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        border: '1px solid #e4e4e7',
        borderRadius: '8px',
        overflow: 'hidden',
        marginTop: '40px',
        marginBottom: '40px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    header: {
        backgroundColor: '#18181b', // Zinc-950
        padding: '24px',
        textAlign: 'left' as const,
        borderBottom: '1px solid #27272a',
    },
    logo: {
        color: '#22d3ee', // Cyan-400
        fontSize: '20px',
        fontWeight: 700,
        letterSpacing: '-0.5px',
        textDecoration: 'none',
    },
    content: {
        padding: '40px',
    },
    tag: {
        display: 'inline-block',
        padding: '4px 12px',
        backgroundColor: '#ecfeff', // Cyan-50
        color: '#0891b2', // Cyan-600
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '20px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    heading: {
        fontSize: '24px',
        lineHeight: '32px',
        color: '#18181b',
        margin: '0 0 16px',
        fontWeight: 700,
    },
    text: {
        fontSize: '16px',
        lineHeight: '26px',
        color: '#52525b', // Zinc-600
        margin: '0 0 24px',
    },
    codeBlock: {
        backgroundColor: '#18181b',
        color: '#e4e4e7',
        padding: '20px',
        borderRadius: '6px',
        fontSize: '14px',
        marginBottom: '24px',
        overflowX: 'auto' as const,
    },
    button: {
        display: 'inline-block',
        backgroundColor: '#0891b2', // Cyan-600
        color: '#ffffff',
        textDecoration: 'none',
        padding: '14px 28px',
        fontSize: '14px',
        fontWeight: 600,
        borderRadius: '6px',
        textAlign: 'center' as const,
    },
    footer: {
        backgroundColor: '#fafafa',
        padding: '24px 40px',
        borderTop: '1px solid #e4e4e7',
        fontSize: '12px',
        color: '#a1a1aa',
        textAlign: 'center' as const,
    }
};

interface NotificationProps {
    type?: string;
    title?: string;
    description?: string;
    actionUrl?: string;
    actionText?: string;
}

export const NotificationEmail = ({
    type = 'Pull Request',
    title = 'Refactor Authentication Module',
    description = 'DevBot has completed the requested refactor. A new pull request #42 is ready for your review. All tests passed (12/12).',
    actionUrl = 'https://devbot.tolani.io/dashboard',
    actionText = 'Review Pull Request',
}: NotificationProps) => {
    return (
        <div style={styles.body as any}>
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                <tr>
                    <td align="center">
                        <div style={styles.container}>
                            {/* Header */}
                            <div style={styles.header}>
                                <span style={styles.logo}>DevBot OS</span>
                            </div>

                            {/* Content */}
                            <div style={styles.content}>
                                <span style={styles.tag}>{type}</span>
                                <h1 style={styles.heading}>{title}</h1>
                                <p style={styles.text}>{description}</p>

                                {/* Simulated Code/Status Block */}
                                <div style={styles.codeBlock}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#4ade80' }}>✔ Build Success</span>
                                        <span style={{ color: '#71717a' }}>2m 14s</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#4ade80' }}>✔ Tests Passed</span>
                                        <span style={{ color: '#71717a' }}>12/12</span>
                                    </div>
                                </div>

                                <a href={actionUrl} style={styles.button}>{actionText}</a>
                            </div>

                            {/* Footer */}
                            <div style={styles.footer}>
                                <p style={{ margin: 0 }}>
                                    Sent by DevBot • <a href="#" style={{ color: '#a1a1aa', textDecoration: 'underline' }}>Notification Settings</a>
                                </p>
                                <p style={{ margin: '8px 0 0' }}>
                                    © 2026 Tolani Labs. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
    );
};
