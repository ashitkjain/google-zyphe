import { describe, it, expect } from 'vitest';
import { calculateTaskDates, calculateChecklistSchedule } from '../services/transactionService';

describe('Transaction Scheduling Engine', () => {
    const baseDate = new Date('2026-01-01T00:00:00Z');

    describe('calculateTaskDates', () => {
        it('should calculate dates correctly with no dependencies', () => {
            const task = { durationDays: 5 };
            const taskEnds = {};
            const { startDate, dueDate } = calculateTaskDates(task, taskEnds, baseDate);

            expect(startDate.toISOString()).toBe(baseDate.toISOString());
            const expectedDue = new Date(baseDate);
            expectedDue.setDate(baseDate.getDate() + 5);
            expect(dueDate.toISOString()).toBe(expectedDue.toISOString());
        });

        it('should shift start date based on dependencies', () => {
            const depEndDate = new Date('2026-01-10T00:00:00Z');
            const task = { dependsOn: ['dep1'], durationDays: 3 };
            const taskEnds = { 'dep1': depEndDate };
            const { startDate, dueDate } = calculateTaskDates(task, taskEnds, baseDate);

            expect(startDate.toISOString()).toBe(depEndDate.toISOString());
            const expectedDue = new Date(depEndDate);
            expectedDue.setDate(depEndDate.getDate() + 3);
            expect(dueDate.toISOString()).toBe(expectedDue.toISOString());
        });

        it('should use the latest dependency as start date', () => {
            const dep1End = new Date('2026-01-05T00:00:00Z');
            const dep2End = new Date('2026-01-15T00:00:00Z');
            const task = { dependsOn: ['dep1', 'dep2'], durationDays: 2 };
            const taskEnds = { 'dep1': dep1End, 'dep2': dep2End };
            const { startDate, dueDate } = calculateTaskDates(task, taskEnds, baseDate);

            expect(startDate.toISOString()).toBe(dep2End.toISOString());
        });
    });

    describe('calculateChecklistSchedule', () => {
        it('should hydrate an entire checklist correctly', () => {
            const categories = [
                {
                    id: 'c1',
                    name: 'Phase 1',
                    tasks: [
                        { id: 't1', name: 'Task 1', durationDays: 2, status: 'Pending', comments: '', dependsOn: [] },
                        { id: 't2', name: 'Task 2', durationDays: 3, status: 'Pending', comments: '', dependsOn: ['t1'] }
                    ]
                }
            ] as any;

            const scheduled = calculateChecklistSchedule(categories, baseDate);

            const t1 = scheduled[0].tasks[0];
            const t2 = scheduled[0].tasks[1];

            expect(t1.startDate.toISOString()).toBe(baseDate.toISOString());
            expect(t1.dueDate.toISOString()).toBe(new Date('2026-01-03T00:00:00Z').toISOString());

            expect(t2.startDate.toISOString()).toBe(t1.dueDate.toISOString());
            expect(t2.dueDate.toISOString()).toBe(new Date('2026-01-06T00:00:00Z').toISOString());
        });

        it('should apply ID mapping correctly', () => {
            const categories = [
                {
                    id: 'c1',
                    name: 'Phase 1',
                    tasks: [
                        { id: 'orig1', name: 'Task 1', durationDays: 1, status: 'Pending', comments: '', dependsOn: [] },
                    ]
                }
            ] as any;
            const idMapping = { 'orig1': 'mapped1' };

            const scheduled = calculateChecklistSchedule(categories, baseDate, idMapping);
            expect(scheduled[0].tasks[0].id).toBe('mapped1');
        });
    });
});
