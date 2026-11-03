/**
 * RoadLanes: Single source of truth for highway lanes, widths, and lateral coordinates.
 *
 * Highway Geometry:
 * - roadCenterX = 0 (the yellow center line)
 * - Total road width = 14m (half-width = 7.0m)
 * - laneWidth = 3.5m (measured directly from road geometry: 2 lanes per side * 3.5m = 7.0m)
 * - lanesPerDirection = 2 (Lane 0 = inside / fast lane near yellow line, Lane 1 = outside / slow lane near shoulder)
 *
 * Direction Conventions:
 * - Direction +1: Player & Same-Direction traffic (travels +Z on the right side of yellow line)
 *   Lanes at lateral offset +X in road right-normal (world -X from road center):
 *   - Lane 0 (inside):  lateralOffset = +1.75m (world x ~ -1.75m)
 *   - Lane 1 (outside): lateralOffset = +5.25m (world x ~ -5.25m)
 *
 * - Direction -1: Oncoming traffic (travels -Z on the left side of yellow line)
 *   Lanes at lateral offset -X in road right-normal (world +X from road center):
 *   - Lane 0 (inside):  lateralOffset = -1.75m (world x ~ +1.75m)
 *   - Lane 1 (outside): lateralOffset = -5.25m (world x ~ +5.25m)
 */
export const RoadLanes = {
    roadCenterX: 0,
    laneWidth: 3.5,
    lanesPerDirection: 2,

    /**
     * Signed lateral distance from yellow center line along the road right-normal.
     * @param direction +1 for player / same-direction, -1 for oncoming
     * @param laneIndex 0 (near yellow divider), 1 (near outer shoulder)
     */
    laneCenterLateralOffset(direction: number, laneIndex: number): number {
        const clampedIndex = Math.max(0, Math.min(this.lanesPerDirection - 1, laneIndex));
        return direction * (clampedIndex + 0.5) * this.laneWidth;
    },

    /**
     * Relative X offset from road center line (where +Z travel has right side at -X).
     * @param direction +1 for player / same-direction, -1 for oncoming
     * @param laneIndex 0 (near yellow divider), 1 (near outer shoulder)
     */
    laneCenterX(direction: number, laneIndex: number): number {
        return -this.laneCenterLateralOffset(direction, laneIndex);
    },

    /**
     * Calculates the closest lane index (0 or 1) from the signed lateral offset.
     * @param direction +1 for player / same-direction, -1 for oncoming
     * @param lateralOffset Signed distance along road right-normal
     */
    getLaneIndex(direction: number, lateralOffset: number): number {
        const distFromCenter = direction * lateralOffset;
        if (distFromCenter <= 0) return 0;
        const index = Math.floor(distFromCenter / this.laneWidth);
        return Math.max(0, Math.min(this.lanesPerDirection - 1, index));
    }
};
