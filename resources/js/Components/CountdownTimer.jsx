import { useState, useEffect } from 'react';

function calculate(endDate) {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
    };
}

export default function CountdownTimer({ endDate }) {
    const [timeLeft, setTimeLeft] = useState(() => calculate(endDate));

    useEffect(() => {
        const id = setInterval(() => setTimeLeft(calculate(endDate)), 1000);
        return () => clearInterval(id);
    }, [endDate]);

    if (!timeLeft) return <span className="text-red-600 font-medium text-sm">Closed</span>;

    return (
        <span className="text-sm text-amber-600 font-medium">
            {timeLeft.days > 0 && `${timeLeft.days}d `}
            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s remaining
        </span>
    );
}
