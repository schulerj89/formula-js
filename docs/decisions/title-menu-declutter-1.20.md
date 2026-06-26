# Title Menu Declutter 1.20

Date: 2026-06-26

## Context

The mobile title screen showed the brand, primary race actions, utility links, player name, track selector, paint swatches, track cards, and Race button together. That preserved access but made the first viewport crowded.

## Decision

Keep Campaign and Time Attack as the primary first-screen actions. Move full player setup into a collapsible Garage panel that opens when the player taps Garage, Campaign, or Time Attack.

## Consequences

- The first mobile title view is easier to scan and leaves more room for the track flyover.
- Name, track, body paint, helmet paint, and Race remain one tap away through Garage.
- Browser smoke now verifies the setup panel is hidden by default and visible after Garage opens.
