# Privacy Policy

_Last updated: 21 June 2026_

## The short version

This app handles some of your most sensitive information: the password and the
optional encryption key for your personal financial records. So the natural
question is how safely I look after that information.

The answer is that I don't look after it at all, because it never reaches me.
Your password, your encryption key, and your financial data stay on your phone
and on the server you choose. I run no servers, I collect nothing, and I have no
way to access any of it.

## What this app is

Actual Wrapper is a thin native shell around [Actual
Budget](https://actualbudget.org/). It loads your own, self-hosted Actual server
inside a WebView and adds a few native conveniences (a settings screen and local
notifications for new transactions). You provide your Actual server's HTTPS URL
during setup, and the app talks only to that server.

## What I collect: nothing

There is no "I" in the data sense. I do not operate a backend, I do not have
accounts, and the app contains no analytics, no crash reporting, no advertising,
and no tracking or telemetry of any kind. No information about you or your usage
is ever sent to me or to any third party. The app does not "phone home."

## Where your sensitive information is kept

Everything sensitive is stored locally on your device, in the operating system's
secure credential store — the Keychain on iOS and the Keystore on Android:

- your Actual **server password**,
- the **login token** the server issues, and
- your **encryption key**, if your budget is end-to-end encrypted.

These are stored with the most restrictive setting available: tied to this
device only, and unlockable only after you have unlocked the device. Your server
URL is kept in ordinary app storage because it is not secret. None of this
leaves your phone except to talk to your own server.

## Network connections

The app connects to exactly one place: the Actual server URL you enter. It uses
that connection to log in and to check for new transactions. Connections must use
HTTPS, and the in-app browser is locked to your server's own address, so the app
cannot be steered to send your data anywhere else.

## Location

Your location is a private matter between you and your phone. If the app asks for
location permission, it is for a single purpose: when you are picking a payee, it
can ask Actual "which payee is near this location?" so it can suggest a nearby
one. Your location is never stored by the app and is never sent to me. If you
prefer, you can simply decline the permission, and the rest of the app works as
normal.

## Notifications

Notifications about new transactions are generated on your device, from data the
app reads from your own server. There is no push service and no third party
involved — the notifications never travel through me.

## Sharing, third parties, and children

I share no data because I collect no data. The app bundles no third-party
analytics or advertising SDKs. The app is not directed at children, and it
gathers no personal information from anyone.

## Your control over your information

You stay in control. Uninstalling the app removes the credentials and settings it
stored on your device. Your financial data itself lives on the Actual server you
chose to use, under your control, not mine.

## Changes to this policy

If this policy changes, the updated version will be posted to this file in the
app's public repository, with a new "last updated" date.

## Contact

Questions about privacy? Email **lakeland@gmail.com**.
