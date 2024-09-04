const cityInput = document.querySelector('.city-input');
const searchBtn = document.querySelector('.search-btn');
const weatherInfoSection = document.querySelector('.weather-info');
const notFoundSection = document.querySelector('.not-found');
const searchCitySection = document.querySelector('.search-city');

const countryTxt = document.querySelector('.country-txt');
const tempTxt = document.querySelector('.temp-txt');
const conditionTxt = document.querySelector('.condition-txt');
const humidityValueTxt = document.querySelector('.humidity-value-txt');
const windValueTxt = document.querySelector('.wind-value-txt');
const weatherSummaryImg = document.querySelector('.weather-summary-img');
const currentDateTxt = document.querySelector('.current-date-txt');

const hourlyWeatherContainer = document.querySelector('.hourly-forecast-items');
const weeklyWeatherContainer = document.querySelector('.seven-day-forecast-items');

const apiKey = 'b6ef7aaee5520a2467038f48b4b691eb'; //add your api key

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleSearch();
});

// Handle Search
function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        updateWeatherInfo(city);
        cityInput.value = '';
        cityInput.blur();
    }
}

// Fetch Data
async function getFetchData(endPoint, city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/${endPoint}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

// Get Weather Icon based on Day or Night
function getWeatherIcon(id, isNight = false) {
    if (id <= 232) return 'thunderstorm.svg';
    if (id <= 321) return 'drizzle.svg';
    if (id <= 531) return 'rain.svg';
    if (id <= 622) return 'snow.svg';
    if (id <= 781) return 'atmosphere.svg';
    if (id === 800) return isNight ? 'night-clear.webp' : 'clear.svg';
    return isNight ? 'night-clouds.svg' : 'clouds.svg';
}

// Get Current Date
function getCurrentDate() {
    const options = { weekday: 'short', day: '2-digit', month: 'short' };
    return new Date().toLocaleDateString('en-GB', options);
}

// Update Weather Info
async function updateWeatherInfo(city) {
    try {
        const weatherData = await getFetchData('weather', city);
        if (weatherData.cod !== 200) {
            showDisplaySection(notFoundSection);
            return;
        }

        const { name: country, main: { temp, humidity }, weather: [{ id, main: weatherCondition }], wind: { speed } } = weatherData;

        countryTxt.textContent = `${country}`;
        tempTxt.textContent = `${Math.round(temp)} °C`;
        conditionTxt.textContent = `${weatherCondition}`;
        humidityValueTxt.textContent = `${humidity}%`;
        windValueTxt.textContent = `${speed} km/h`;
        currentDateTxt.textContent = `${getCurrentDate()}`;
        weatherSummaryImg.src = `assets/weather/${getWeatherIcon(id)}`;

        await updateHourlyWeather(city, { temp, id });
        await updateWeeklyWeather(city);
        showDisplaySection(weatherInfoSection);
    } catch (error) {
        console.error('Error updating weather information:', error);
        showDisplaySection(notFoundSection);
    }
}

// Update Hourly Weather
async function updateHourlyWeather(city, currentWeather) {
    try {
        const hourlyWeatherData = await getFetchData('forecast', city);
        const currentTime = new Date();
        const endTime = new Date(currentTime.getTime() + 26 * 60 * 60 * 1000);

        const hourlyData = hourlyWeatherData.list
            .filter(item => new Date(item.dt_txt) <= endTime)
            .reduce((acc, curr, index, arr) => {
                if (index === arr.length - 1) return acc;
                const next = arr[index + 1];
                const intervalData = Array.from({ length: 3 }, (_, i) => interpolateWeatherData(curr, next, i / 3));
                return acc.concat(intervalData);
            }, []);

        const filteredHourlyData = hourlyData.filter(item => new Date(item.dt_txt) >= currentTime && new Date(item.dt_txt) <= endTime);

        hourlyWeatherContainer.innerHTML = '';
        updateHourlyWeatherItems({ temp: currentWeather.temp, id: currentWeather.id, dt_txt: currentTime.toISOString() }, 'Now');
        filteredHourlyData.forEach(weather => updateHourlyWeatherItems(weather));
    } catch (error) {
        console.error('Error fetching hourly weather data:', error);
    }
}

// Interpolate Weather Data
function interpolateWeatherData(current, next, ratio) {
    const interpolate = (a, b) => a + (b - a) * ratio;
    const temp = interpolate(current.main.temp, next.main.temp);
    const id = ratio < 0.5 ? current.weather[0].id : next.weather[0].id;
    const time = new Date(new Date(current.dt_txt).getTime() + ratio * (new Date(next.dt_txt).getTime() - new Date(current.dt_txt).getTime()));
    return { temp, id, dt_txt: time.toISOString() };
}

// Update Hourly Weather Items
function updateHourlyWeatherItems(weatherData, label = '') {
    const { dt_txt: time, id, temp } = weatherData;
    const date = new Date(time);
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const timeTaken = date.toLocaleTimeString([], timeOptions).toUpperCase();

    // Determine if it's night time (from 6 PM to 6 AM)
    const isNight = date.getHours() >= 18 || date.getHours() < 6;

    const hourlyWeatherItem = `
        <div class="hourly-weather-item">
            <h5 class="hourly-weather-time">${label || timeTaken}</h5>
            <img src="assets/weather/${getWeatherIcon(id, isNight)}" class="hourly-weather-img">
            <h5 class="hourly-weather-temp">${Math.round(temp)} °C</h5>
        </div>
    `;
    hourlyWeatherContainer.insertAdjacentHTML('beforeend', hourlyWeatherItem);
}

// Update weekly weather
async function updateWeeklyWeather(city) {
    try {
        const [currentWeatherData, weeklyWeatherData] = await Promise.all([
            getFetchData('weather', city),
            getFetchData('forecast', city)
        ]);

        weeklyWeatherContainer.innerHTML = '';

        const dailyWeather = {};
        weeklyWeatherData.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            if (!dailyWeather[date]) {
                dailyWeather[date] = {
                    temp_max: item.main.temp,
                    temp_min: item.main.temp,
                    id: item.weather[0].id,
                    description: item.weather[0].description
                };
            } else {
                dailyWeather[date].temp_max = Math.max(dailyWeather[date].temp_max, item.main.temp);
                dailyWeather[date].temp_min = Math.min(dailyWeather[date].temp_min, item.main.temp);
            }
        });

        const dates = Object.keys(dailyWeather).sort();

        const totalDays = 7;
        if (dates.length < totalDays) {
            const lastDate = new Date(dates[dates.length - 1]);
            const lastTempMax = dailyWeather[dates[dates.length - 1]].temp_max;
            const lastTempMin = dailyWeather[dates[dates.length - 1]].temp_min;
            const lastIconId = dailyWeather[dates[dates.length - 1]].id;
            const lastDescription = dailyWeather[dates[dates.length - 1]].description;

            while (dates.length < totalDays) {
                lastDate.setDate(lastDate.getDate() + 1);
                const newDate = lastDate.toISOString().split('T')[0];
                const estimatedTempMax = lastTempMax + (Math.random() * 2 - 1);
                const estimatedTempMin = lastTempMin + (Math.random() * 2 - 1);

                dailyWeather[newDate] = {
                    temp_max: estimatedTempMax,
                    temp_min: estimatedTempMin,
                    id: lastIconId,
                    description: lastDescription
                };

                dates.push(newDate);
            }
        }

        // Today's date
        const todayDate = new Date().toISOString().split('T')[0];
        const todayWeather = dailyWeather[todayDate] || {
            temp_max: currentWeatherData.main.temp_max,
            temp_min: currentWeatherData.main.temp_min,
            id: currentWeatherData.weather[0].id,
            description: currentWeatherData.weather[0].description
        };

        const todayWeatherItem = `
            <div class="weekly-weather-item">
                <h5 class="weekly-weather-day">Today</h5>
                <img src="assets/weather/${getWeatherIcon(todayWeather.id)}" class="weekly-weather-img" alt="Today Weather">
                <h5 class="weekly-weather-temp">${Math.round(todayWeather.temp_max)} °C / ${Math.round(todayWeather.temp_min)} °C</h5>
                <p class="weekly-weather-condition">${todayWeather.description}</p>
            </div>
        `;
        weeklyWeatherContainer.insertAdjacentHTML('beforeend', todayWeatherItem);

        // Render tomorrow's weather
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowDateString = tomorrowDate.toISOString().split('T')[0];
        const tomorrowWeather = dailyWeather[tomorrowDateString] || { temp_max: 0, temp_min: 0, id: 800, description: 'clear sky' }; // Default to clear weather
        const tomorrowWeatherItem = `
            <div class="weekly-weather-item">
                <h5 class="weekly-weather-day">Tomorrow</h5>
                <img src="assets/weather/${getWeatherIcon(tomorrowWeather.id)}" class="weekly-weather-img" alt="Tomorrow Weather">
                <h5 class="weekly-weather-temp">${Math.round(tomorrowWeather.temp_max)} °C / ${Math.round(tomorrowWeather.temp_min)} °C</h5>
                <p class="weekly-weather-condition">${tomorrowWeather.description}</p>
            </div>
        `;
        weeklyWeatherContainer.insertAdjacentHTML('beforeend', tomorrowWeatherItem);

        // Render remaining days
        dates.slice(2, totalDays).forEach(date => {
            const { temp_max, temp_min, id, description } = dailyWeather[date];
            const weekDay = new Date(date).toLocaleDateString('en-GB', { weekday: 'short' });

            const weeklyWeatherItem = `
                <div class="weekly-weather-item">
                    <h5 class="weekly-weather-day">${weekDay}</h5>
                    <img src="assets/weather/${getWeatherIcon(id)}" class="weekly-weather-img" alt="${weekDay} Weather">
                    <h5 class="weekly-weather-temp">${Math.round(temp_max)} °C / ${Math.round(temp_min)} °C</h5>
                    <p class="weekly-weather-condition">${description}</p>
                </div>
            `;

            weeklyWeatherContainer.insertAdjacentHTML('beforeend', weeklyWeatherItem);
        });
    } catch (error) {
        console.error('Error fetching weekly weather data:', error);
    }
}

// Show Display Section
function showDisplaySection(sectionToShow) {
    [weatherInfoSection, notFoundSection, searchCitySection].forEach(section => {
        section.style.display = (section === sectionToShow) ? 'block' : 'none';
    });
}
