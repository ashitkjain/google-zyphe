---
description: How to configure Firebase Email Trigger with SendGrid
---

# Setting up SendGrid with Firebase

To make the "Invite Client" feature work, you need to connect the Firebase "Trigger Email" extension to a SendGrid account.

1.  **Get SendGrid API Key**:
    *   Log in to [SendGrid](https://app.sendgrid.com/).
    *   Go to **Settings** > **API Keys**.
    *   Click **Create API Key**.
    *   Name it "Firebase Extension".
    *   Select **Restricted Access**.
    *   Scroll down to **Mail Send** and click the circle to grant "Full Access" (strictly for sending mail).
    *   Click **Create & View**.
    *   **COPY THIS KEY**. You will only see it once. (It starts with `SG...`).

2.  **Verify Sender Identity**:
    *   In SendGrid, go to **Settings** > **Sender Authentication**.
    *   Verify a Single Sender (e.g., your email `you@gmail.com`) or your entire Domain.
    *   *Note: Emails will fail if you try to send FROM an address that isn't verified here.*

3.  **Configure Firebase Extension**:
    *   Go to your [Firebase Console](https://console.firebase.google.com/).
    *   Go to **Extensions** (left sidebar).
    *   Find "Trigger Email from Firestore" (if installed, click "Manage" -> "Reconfigure"; if not, install it).

4.  **Enter Configuration Details**:
    *   **SMTP Connection URI**:
        ```
        smtps://apikey:YOUR_SENDGRID_API_KEY_HERE@smtp.sendgrid.net:465
        ```
        *Replace `YOUR_SENDGRID_API_KEY_HERE` with the `SG...` key you copied.*
        *Note: The username is literally the word `apikey`.*

    *   **Email documents collection**: `mail` (Must match our code).
    *   **Default FROM address**: Enter the email you verified in Step 2.

5.  **Save/Install**.
    *   It may take 3-5 minutes to deploy.

# Alternative: Using Gmail (Free for low volume)

If you don't want to use SendGrid, you can use a Gmail account (up to ~500 emails/day).

1.  **Enable App Password**:
    *   Go to your [Google Account Security](https://myaccount.google.com/security).
    *   Enable **2-Step Verification** (if not already on).
    *   Search for "App Passwords" (or go to [App Passwords](https://myaccount.google.com/apppasswords)).
    *   Create a new app password named "Firebase".
    *   **COPY THIS PASSWORD**. (It looks like `abcd efgh ijkl mnop`).

2.  **Configure Firebase Extension**:
    *   **SMTP Connection URI**:
        ```
        smtps://YOUR_GMAIL_ADDRESS@gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465
        ```
        *Example:* `smtps://john.doe@gmail.com:abcd1234efgh5678@smtp.gmail.com:465`
    *   **Default FROM address**: Your Gmail address.

## Testing
Once deployed:
1.  Go to your app as a Realtor.
2.  Click "Add Client".
3.  Enter a test email and click "Send Email".
4.  Check the Firebase Console > Firestore > `mail` collection. You should see a document appear.
5.  After a few seconds, the document should get a `delivery` field with a state of `SUCCESS` (or `ERROR` which will tell you what went wrong).
