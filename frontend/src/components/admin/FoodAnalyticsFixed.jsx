import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { toast } from 'react-hot-toast';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PptxGenJs from 'pptxgenjs';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
);

const FoodAnalytics = () => {
    const { token } = useAdmin();
    const [loading, setLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [filters, setFilters] = useState({
        dateFilter: 'thisMonth',
        customStartDate: '',
        customEndDate: '',
        mealTypes: 'all'
    });

    // Meal times configuration for time-based filtering
    const MEAL_TIMES = {
        breakfast: { start: 7, end: 9 },      // 7:00 AM - 9:00 AM
        lunch: { start: 12, end: 14 },        // 12:00 PM - 2:00 PM
        snacks: { start: 16, end: 18 },       // 4:00 PM - 6:00 PM
        dinner: { start: 19, end: 21 }        // 7:00 PM - 9:00 PM
    };

    // Refs for capturing chart images
    const dashboardRef = useRef(null);
    const chartsRefs = useRef({
        trendChart: null,
        mealTypeChart: null,
        weekdayChart: null,
        pausePercentageChart: null,
        weekdayMealChart: null
    });

    const getDefaultAnalyticsData = () => ({
        summary: {
            totalMealsServed: 0,
            totalMealsPaused: 0,
            totalMealsResumed: 0,
            pausePercentage: 0,
            averagePausesPerStudent: 0,
            peakPauseDay: null,
            peakPauseMeal: null
        },
        trends: { 
            daily: [
                { date: new Date().toISOString(), served: 0, paused: 0, resumed: 0 }
            ] 
        },
        distributions: { 
            mealTypes: { breakfast: { paused: 0, served: 0 }, lunch: { paused: 0, served: 0 }, snacks: { paused: 0, served: 0 }, dinner: { paused: 0, served: 0 } },
            weekdays: { Monday: { served: 0, paused: 0 }, Tuesday: { served: 0, paused: 0 }, Wednesday: { served: 0, paused: 0 }, Thursday: { served: 0, paused: 0 }, Friday: { served: 0, paused: 0 }, Saturday: { served: 0, paused: 0 }, Sunday: { served: 0, paused: 0 } }
        },
        insights: []
    });

    // Initialize with default data
    useEffect(() => {
        setAnalyticsData(getDefaultAnalyticsData());
    }, []);

    // Fetch data when filters change
    useEffect(() => {
        if (token) {
            console.log('[UseEffect] Triggering fetchAnalyticsData');
            fetchAnalyticsData();
        } else {
            console.warn('[UseEffect] No token available, skipping fetch');
        }
    }, [filters, token]);

    const fetchAnalyticsData = async () => {
        if (!token) {
            console.warn('[Analytics] No token available - skipping fetch');
            return;
        }
        
        try {
            setLoading(true);
            const queryParams = new URLSearchParams(filters).toString();
            const fullUrl = `${import.meta.env.VITE_SERVER_URL}/food-api/analytics/dashboard-data?${queryParams}`;
            
            const response = await axios.get(fullUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data?.data) {                
                setAnalyticsData(response.data.data);
            } else {                
                if (response.data?.success) {
                    setAnalyticsData(response.data);
                } else {
                    setAnalyticsData(getDefaultAnalyticsData());
                }
            }
        } catch (error) {
            console.error('========== ANALYTICS DATA FETCH ERROR ==========');
            console.error('[Error] Error type:', error.constructor.name);
            console.error('[Error] Error message:', error.message);
            console.error('[Error] Full error object:', error);
            
            if (error.response) {
                console.error('[HTTP] Status code:', error.response.status);
                console.error('[HTTP] Status text:', error.response.statusText);
                console.error('[HTTP] Response data:', error.response.data);
                console.error('[HTTP] Response headers:', error.response.headers);
            } else if (error.request) {
                console.error('[Request] No response received');
                console.error('[Request] Request object:', error.request);
            } else {
                console.error('[Setup] Error setting up request:', error.message);
            }
            
            toast.error(`Error fetching analytics: ${error.response?.data?.message || error.message}`);
            console.log('[Fallback] Loading default analytics data due to error');
            setAnalyticsData(getDefaultAnalyticsData());
            console.error('========== ANALYTICS DATA FETCH ERROR END ==========' + "\n");
        } finally {
            setLoading(false);
            console.log('[Loading] setLoading(false) called');
        }
    };
    

    // Get available meal types based on current time (for "Today" filter)
    const getAvailableMealTypes = () => {
        const now = new Date();
        const currentHour = now.getHours();
        const availableMeals = [];

        // Check each meal type to see if it has started
        Object.entries(MEAL_TIMES).forEach(([meal, times]) => {
            if (currentHour >= times.start) {
                availableMeals.push(meal);
            }
        });

        return availableMeals;
    };

    // Check if a meal type should be available in the dropdown
    const isMealTypeAvailable = (mealType) => {
        if (filters.dateFilter !== 'today') {
            // All meals available for non-today filters
            return true;
        }
        
        // For today, only show meals that have started
        const availableMeals = getAvailableMealTypes();
        const mealTypes = mealType.split(',').map(m => m.trim());
        
        // Check if all meals in the option have started
        return mealTypes.every(meal => availableMeals.includes(meal));
    };

    // Auto-adjust meal type filter when switching to "Today" or from "Today"
    useEffect(() => {
        if (filters.dateFilter === 'today') {
            const availableMeals = getAvailableMealTypes();
            
            // If current meal type selection is not available, switch to first available meal
            if (filters.mealTypes !== 'all') {
                const selectedMeals = filters.mealTypes.split(',').map(m => m.trim());
                if (!selectedMeals.every(meal => availableMeals.includes(meal))) {
                    // If no meals are available yet, keep as 'all'
                    if (availableMeals.length === 0) {
                        setFilters(prev => ({ ...prev, mealTypes: 'all' }));
                    } else {
                        // Otherwise set to first available meal
                        setFilters(prev => ({ ...prev, mealTypes: availableMeals[0] }));
                    }
                }
            }
        }
    }, [filters.dateFilter]);

    const handleFilterChange = (key, value) => {
        console.log(`[Filter Change] ${key}: "${value}"`);
        setFilters(prev => {
            const updated = {
                ...prev,
                [key]: value
            };
            console.log('[Filter Change] Updated filters:', updated);
            return updated;
        });
    };

    const handleExportPDF = async () => {
        console.log('[PDF Export] Starting PDF export...');
        try {
            const element = dashboardRef.current;
            if (!element) {
                toast.error('Dashboard content not found');
                return;
            }

            // Create canvas from dashboard
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });

            // Create PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 297; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = 0;

            // Add title page
            pdf.setFontSize(24);
            pdf.text('Food Management Analytics Report', 15, 30);
            pdf.setFontSize(12);
            pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 50);
            pdf.text(`Filters: ${filters.dateFilter} | Meals: ${filters.mealTypes}`, 15, 60);

            // Add content pages
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 280;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= 280;
            }

            pdf.save(`Analytics_Report_${new Date().getTime()}.pdf`);
            console.log('[PDF Export] ✓ PDF exported successfully');
            toast.success('PDF exported successfully!');
        } catch (error) {
            console.error('[PDF Export] Error:', error);
            toast.error('Error exporting PDF: ' + error.message);
        }
    };

    const handleExportPowerPoint = async () => {
        console.log('[PPT Export] Starting PowerPoint export...');
        try {
            const pres = new PptxGenJs();
            pres.defineLayout({ name: 'LAYOUT1', width: 10, height: 7.5 });

            // Slide 1: Title Slide
            let slide = pres.addSlide();
            slide.background = { color: '1F4788' };
            slide.addText('Food Management Analytics Report', {
                x: 0.5,
                y: 2.5,
                w: 9,
                h: 1,
                fontSize: 44,
                bold: true,
                color: 'FFFFFF',
                align: 'center'
            });
            slide.addText(`Generated on ${new Date().toLocaleDateString()}`, {
                x: 0.5,
                y: 3.8,
                w: 9,
                h: 0.5,
                fontSize: 18,
                color: 'E0E0E0',
                align: 'center'
            });

            // Slide 2: Summary Metrics
            slide = pres.addSlide();
            slide.background = { color: 'F5F5F5' };
            slide.addText('Summary Metrics', {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.4,
                fontSize: 32,
                bold: true,
                color: '1F4788'
            });

            const metrics = [
                { label: 'Total Served', value: analyticsData?.summary?.totalMealsServed || 0, color: '4472C4' },
                { label: 'Total Paused', value: analyticsData?.summary?.totalMealsPaused || 0, color: 'FFC000' },
                { label: 'Total Resumed', value: analyticsData?.summary?.totalMealsResumed || 0, color: '70AD47' },
                { label: 'Pause Rate', value: (analyticsData?.summary?.pausePercentage?.toFixed(1) || 0) + '%', color: '17A2B8' }
            ];

            let yPos = 1.2;
            metrics.forEach((metric, idx) => {
                const xPos = (idx % 2) * 4.5 + 0.5;
                const yPosition = yPos + Math.floor(idx / 2) * 2;

                // Box background
                slide.addShape(pres.ShapeType.rect, {
                    x: xPos,
                    y: yPosition,
                    w: 4,
                    h: 1.5,
                    fill: { color: metric.color },
                    line: { color: metric.color }
                });

                // Label
                slide.addText(metric.label, {
                    x: xPos + 0.2,
                    y: yPosition + 0.2,
                    w: 3.6,
                    h: 0.4,
                    fontSize: 14,
                    bold: true,
                    color: 'FFFFFF'
                });

                // Value
                slide.addText(metric.value.toString(), {
                    x: xPos + 0.2,
                    y: yPosition + 0.7,
                    w: 3.6,
                    h: 0.6,
                    fontSize: 28,
                    bold: true,
                    color: 'FFFFFF',
                    align: 'center'
                });
            });

            // Slide 3: Meal Distribution
            slide = pres.addSlide();
            slide.background = { color: 'F5F5F5' };
            slide.addText('Meal Distribution Details', {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.4,
                fontSize: 32,
                bold: true,
                color: '1F4788'
            });

            // Create table for meal distribution
            const mealData = [];
            mealData.push(['Meal Type', 'Total', 'Paused', 'Served', 'Pause Rate %']);
            
            Object.entries(analyticsData?.distributions?.mealTypes || {}).forEach(([meal, data]) => {
                const total = (data.paused || 0) + (data.served || 0);
                const pauseRate = total > 0 ? ((data.paused || 0) / total * 100).toFixed(1) : 0;
                mealData.push([
                    meal.charAt(0).toUpperCase() + meal.slice(1),
                    total.toString(),
                    (data.paused || 0).toString(),
                    (data.served || 0).toString(),
                    pauseRate + '%'
                ]);
            });

            slide.addTable(mealData, {
                x: 0.5,
                y: 1,
                w: 9,
                h: 5,
                colW: [2, 1.5, 1.5, 1.5, 1.5],
                border: { pt: 1, color: '1F4788' },
                fill: { color: 'E8F0F8' },
                fontSize: 12,
                align: 'center',
                valign: 'middle'
            });

            // Slide 4: Insights
            if (analyticsData?.insights && analyticsData.insights.length > 0) {
                slide = pres.addSlide();
                slide.background = { color: 'F5F5F5' };
                slide.addText('Automated Insights', {
                    x: 0.5,
                    y: 0.3,
                    w: 9,
                    h: 0.4,
                    fontSize: 32,
                    bold: true,
                    color: '1F4788'
                });

                let insightY = 1.2;
                analyticsData.insights.slice(0, 6).forEach((insight, idx) => {
                    slide.addText(`• ${insight}`, {
                        x: 0.7,
                        y: insightY,
                        w: 8.6,
                        h: 0.8,
                        fontSize: 11,
                        color: '333333',
                        valign: 'top',
                        wordWrap: true
                    });
                    insightY += 0.9;
                });
            }

            // Save presentation
            pres.save(`Analytics_Report_${new Date().getTime()}.pptx`);
            console.log('[PPT Export] ✓ PowerPoint exported successfully');
            toast.success('PowerPoint exported successfully!');
        } catch (error) {
            console.error('[PPT Export] Error:', error);
            toast.error('Error exporting PowerPoint: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="text-center my-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading analytics data...</p>
            </div>
        );
    }

    return (
        <div className="food-analytics">
            {/* Filter Section */}
            <div className="card mb-4">
                <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">
                        <i className="bi bi-funnel me-2"></i>
                        Analytics Filters
                    </h5>
                </div>
                {/* ## TODO : total served are not coming form DB since not present create a collection to store each meal's served count */}
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label">Date Range</label>
                            <select
                                className="form-select"
                                value={filters.dateFilter}
                                onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                            >
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="thisWeek">This Week</option>
                                <option value="lastWeek">Last Week</option>
                                <option value="thisMonth">This Month</option>
                                <option value="lastMonth">Last Month</option>
                                <option value="thisYear">This Year</option>
                                <option value="lastYear">Last Year</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>
                        
                        {filters.dateFilter === 'custom' && (
                            <>
                                <div className="col-md-2">
                                    <label className="form-label">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.customStartDate}
                                        onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.customEndDate}
                                        onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        
                        <div className="col-md-3">
                            <label className="form-label">Meal Types</label>
                            <select
                                className="form-select"
                                value={filters.mealTypes}
                                onChange={(e) => handleFilterChange('mealTypes', e.target.value)}
                            >
                                <option value="all" disabled={!isMealTypeAvailable('all')}>All Meals</option>
                                <option value="breakfast" disabled={!isMealTypeAvailable('breakfast')}>Breakfast Only</option>
                                <option value="lunch" disabled={!isMealTypeAvailable('lunch')}>Lunch Only</option>
                                <option value="snacks" disabled={!isMealTypeAvailable('snacks')}>Snacks Only</option>
                                <option value="dinner" disabled={!isMealTypeAvailable('dinner')}>Dinner Only</option>
                                <option value="breakfast,lunch" disabled={!isMealTypeAvailable('breakfast,lunch')}>Breakfast & Lunch</option>
                                <option value="lunch,dinner" disabled={!isMealTypeAvailable('lunch,dinner')}>Lunch & Dinner</option>
                            </select>
                        </div>
                        
                        <div className="col-md-3 d-flex align-items-end gap-2">
                            {/* <button
                                className="btn btn-success"
                                onClick={handleExportPDF}
                            >
                                <i className="bi bi-file-pdf me-2"></i>
                                Export PDF
                            </button> */}
                            {/* <button
                                className="btn btn-info"
                                onClick={handleExportPowerPoint}
                            >
                                <i className="bi bi-file-ppt me-2"></i>
                                Export PPT
                            </button> */}
                        </div>
                        
                    </div>
                </div>
            </div>

            {loading && (
                <div className="card">
                    <div className="card-body text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3 text-muted">Loading analytics data...</p>
                    </div>
                </div>
            )}

            {!loading && (
                <div>
                    {(() => {
                        const data = analyticsData || getDefaultAnalyticsData();
                        return (
                            <>
                    {/* Summary Cards */}
                    <div className="row g-4 mb-4">
                        <div className="col-md-3">
                            <div className="card bg-primary text-white h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h6 className="card-title">Total Served</h6>
                                            <h2 className="display-4">{data.summary?.totalMealsServed || 0}</h2>
                                        </div>
                                        <div className="align-self-center">
                                            <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-warning text-white h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h6 className="card-title">Total Paused</h6>
                                            <h2 className="display-4">{data.summary?.totalMealsPaused || 0}</h2>
                                        </div>
                                        <div className="align-self-center">
                                            <i className="bi bi-pause-circle" style={{ fontSize: '2rem' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-success text-white h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h6 className="card-title">Total Resumed</h6>
                                            <h2 className="display-4">{data.summary?.totalMealsResumed || 0}</h2>
                                        </div>
                                        <div className="align-self-center">
                                            <i className="bi bi-play-circle" style={{ fontSize: '2rem' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-info text-white h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h6 className="card-title">Pause Rate</h6>
                                            <h2 className="display-4">{data.summary?.pausePercentage?.toFixed(1) || 0}%</h2>
                                        </div>
                                        <div className="align-self-center">
                                            <i className="bi bi-percent" style={{ fontSize: '2rem' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Served vs Paused Trends</h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '300px' }}>
                                        <Line
                                            data={{
                                                labels: data.trends?.daily?.map(d => {
                                                    const date = new Date(d.date);
                                                    return date.toLocaleDateString();
                                                }) || [],
                                                datasets: [
                                                    {
                                                        label: 'Meals Served',
                                                        data: data.trends?.daily?.map(d => d.served) || [],
                                                        borderColor: '#198754',
                                                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                                                        fill: true,
                                                    },
                                                    {
                                                        label: 'Meals Paused',
                                                        data: data.trends?.daily?.map(d => d.paused) || [],
                                                        borderColor: '#ffc107',
                                                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                                        fill: true,
                                                    }
                                                ]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'top',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Daily Food Service Trends'
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        title: {
                                                            display: true,
                                                            text: 'Number of Meals'
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Meal Type Distribution</h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '300px' }}>
                                        <Doughnut
                                            data={{
                                                labels: Object.keys(data.distributions?.mealTypes || {}),
                                                datasets: [{
                                                    data: Object.values(data.distributions?.mealTypes || {}).map(m => m.paused || 0),
                                                    backgroundColor: [
                                                        '#FF6384',
                                                        '#36A2EB',
                                                        '#FFCE56',
                                                        '#4BC0C0'
                                                    ],
                                                    borderWidth: 2
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'bottom',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Paused Meals by Type'
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekday Analysis */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Weekday Analysis</h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '300px' }}>
                                        <Bar
                                            data={{
                                                labels: Object.keys(data.distributions?.weekdays || {}),
                                                datasets: [
                                                    {
                                                        label: 'Meals Served',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(d => d.served || 0),
                                                        backgroundColor: 'rgba(25, 135, 84, 0.8)',
                                                        borderColor: '#198754',
                                                        borderWidth: 1
                                                    },
                                                    {
                                                        label: 'Meals Paused',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(d => d.paused || 0),
                                                        backgroundColor: 'rgba(255, 193, 7, 0.8)',
                                                        borderColor: '#ffc107',
                                                        borderWidth: 1
                                                    }
                                                ]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'top',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Food Service by Day of Week'
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        title: {
                                                            display: true,
                                                            text: 'Number of Meals'
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pause Percentage by Meal Type - Pie Chart */}
                    <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Pause Percentage by Meal Type</h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '300px' }}>
                                        <Pie
                                            data={{
                                                labels: Object.keys(data.distributions?.mealTypes || {}).map(meal => meal.charAt(0).toUpperCase() + meal.slice(1)),
                                                datasets: [{
                                                    label: 'Pause Percentage',
                                                    data: Object.values(data.distributions?.mealTypes || {}).map(meal => {
                                                        const total = (meal.paused || 0) + (meal.served || 0);
                                                        return total > 0 ? ((meal.paused || 0) / total * 100) : 0;
                                                    }),
                                                    backgroundColor: [
                                                        '#FF6384',
                                                        '#36A2EB',
                                                        '#FFCE56',
                                                        '#4BC0C0'
                                                    ],
                                                    borderColor: [
                                                        '#FF6384',
                                                        '#36A2EB',
                                                        '#FFCE56',
                                                        '#4BC0C0'
                                                    ],
                                                    borderWidth: 2
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'bottom',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Pause Rates for Each Meal Type (%)'
                                                    },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: function(context) {
                                                                return context.label + ': ' + context.parsed + '%';
                                                            }
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Paused Meals by Weekday and Meal Type - Grouped Bar Chart */}
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Paused Meals by Weekday & Type</h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '300px' }}>
                                        <Bar
                                            data={{
                                                labels: Object.keys(data.distributions?.weekdays || {}),
                                                datasets: [
                                                    {
                                                        label: 'Breakfast Paused',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(weekday => 
                                                            weekday.mealBreakdown?.breakfast || 0
                                                        ),
                                                        backgroundColor: 'rgba(255, 99, 132, 0.8)',
                                                        borderColor: '#FF6384',
                                                        borderWidth: 1
                                                    },
                                                    {
                                                        label: 'Lunch Paused',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(weekday => 
                                                            weekday.mealBreakdown?.lunch || 0
                                                        ),
                                                        backgroundColor: 'rgba(54, 162, 235, 0.8)',
                                                        borderColor: '#36A2EB',
                                                        borderWidth: 1
                                                    },
                                                    {
                                                        label: 'Snacks Paused',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(weekday => 
                                                            weekday.mealBreakdown?.snacks || 0
                                                        ),
                                                        backgroundColor: 'rgba(255, 206, 86, 0.8)',
                                                        borderColor: '#FFCE56',
                                                        borderWidth: 1
                                                    },
                                                    {
                                                        label: 'Dinner Paused',
                                                        data: Object.values(data.distributions?.weekdays || {}).map(weekday => 
                                                            weekday.mealBreakdown?.dinner || 0
                                                        ),
                                                        backgroundColor: 'rgba(75, 192, 192, 0.8)',
                                                        borderColor: '#4BC0C0',
                                                        borderWidth: 1
                                                    }
                                                ]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                indexAxis: 'x',
                                                plugins: {
                                                    legend: {
                                                        position: 'top',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Paused Meals Count by Weekday & Meal Type'
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        title: {
                                                            display: true,
                                                            text: 'Count of Meals Paused'
                                                        }
                                                    },
                                                    x: {
                                                        title: {
                                                            display: true,
                                                            text: 'Day of Week'
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Trends Table
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Custom Range Trends Details</h5>
                                </div>
                                <div className="card-body">
                                    <div className="table-responsive">
                                        <table className="table table-hover table-sm">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Date</th>
                                                    <th className="text-end">Served</th>
                                                    <th className="text-end">Paused</th>
                                                    <th className="text-end">Resumed</th>
                                                    <th className="text-end">Pause Rate %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.trends?.daily && data.trends.daily.length > 0 ? (
                                                    data.trends.daily.map((day, index) => {
                                                        const total = (day.served || 0) + (day.paused || 0);
                                                        const pauseRate = total > 0 ? ((day.paused || 0) / total * 100).toFixed(1) : 0;
                                                        return (
                                                            <tr key={index}>
                                                                <td><strong>{new Date(day.date).toLocaleDateString()}</strong></td>
                                                                <td className="text-end"><span className="badge bg-success">{day.served || 0}</span></td>
                                                                <td className="text-end"><span className="badge bg-warning">{day.paused || 0}</span></td>
                                                                <td className="text-end"><span className="badge bg-info">{day.resumed || 0}</span></td>
                                                                <td className="text-end">
                                                                    <span className={`badge ${pauseRate > 20 ? 'bg-danger' : pauseRate > 10 ? 'bg-warning' : 'bg-success'}`}>
                                                                        {pauseRate}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="text-center text-muted">No daily trend data available</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div> */}

                    {/* Meal Distribution Table */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">Meal Distribution Details</h5>
                                </div>
                                <div className="card-body">
                                    <div className="table-responsive">
                                        <table className="table table-hover table-sm">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Meal Type</th>
                                                    <th className="text-end">Total Meals</th>
                                                    <th className="text-end">Paused</th>
                                                    <th className="text-end">Served</th>
                                                    <th className="text-end">Pause Rate %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.distributions?.mealTypes && Object.keys(data.distributions.mealTypes).length > 0 ? (
                                                    Object.entries(data.distributions.mealTypes).map(([mealType, mealItem]) => {
                                                        const total = (mealItem.paused || 0) + (mealItem.served || 0);
                                                        const pauseRate = total > 0 ? ((mealItem.paused || 0) / total * 100).toFixed(1) : 0;
                                                        return (
                                                            <tr key={mealType}>
                                                                <td><strong className="text-capitalize">{mealType}</strong></td>
                                                                <td className="text-end"><span className="badge bg-secondary">{total}</span></td>
                                                                <td className="text-end"><span className="badge bg-warning">{mealItem.paused || 0}</span></td>
                                                                <td className="text-end"><span className="badge bg-success">{mealItem.served || 0}</span></td>
                                                                <td className="text-end">
                                                                    <span className={`badge ${pauseRate > 20 ? 'bg-danger' : pauseRate > 10 ? 'bg-warning' : 'bg-success'}`}>
                                                                        {pauseRate}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="text-center text-muted">No meal type data available</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards */}
                    <div className="row mb-4">
                        <div className="col-md-4">
                            <div className="card bg-light h-100">
                                <div className="card-body text-center">
                                    <i className="bi bi-calendar-date text-primary" style={{ fontSize: '2rem' }}></i>
                                    <h6 className="card-title mt-2">Peak Pause Day</h6>
                                    <p className="mb-0 fw-bold">
                                        {data.summary?.peakPauseDay || 'No data'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card bg-light h-100">
                                <div className="card-body text-center">
                                    <i className="bi bi-cup-hot text-warning" style={{ fontSize: '2rem' }}></i>
                                    <h6 className="card-title mt-2">Most Paused Meal</h6>
                                    <p className="mb-0 fw-bold text-capitalize">
                                        {data.summary?.peakPauseMeal || 'No data'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card bg-light h-100">
                                <div className="card-body text-center">
                                    <i className="bi bi-person text-info" style={{ fontSize: '2rem' }}></i>
                                    <h6 className="card-title mt-2">Avg Pauses/Student</h6>
                                    <p className="mb-0 fw-bold">
                                        {data.summary?.averagePausesPerStudent?.toFixed(1) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insights Section */}
                    {/* <div className="card">
                        <div className="card-header bg-info text-white">
                            <h5 className="mb-0">
                                <i className="bi bi-lightbulb me-2"></i>
                                Automated Insights
                            </h5>
                        </div>
                        <div className="card-body">
                            {data.insights && data.insights.length > 0 ? (
                                <div className="row">
                                    {data.insights.map((insight, index) => (
                                        <div key={index} className="col-md-6 mb-3">
                                            <div className="alert alert-info mb-0">
                                                <i className="bi bi-info-circle me-2"></i>
                                                {insight}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted">
                                    <i className="bi bi-graph-up" style={{ fontSize: '3rem' }}></i>
                                    <p className="mt-2">No significant patterns detected in the current data range.</p>
                                </div>
                            )}
                        </div>
                    </div> */}
                        </>);
                    })()}
                </div>
            )}
        </div>
    );
};

export default FoodAnalytics;

