import React from 'react';
import { useUIStore } from '../../store/uiStore';

export default function Rules() {
  const { setScreen } = useUIStore();
  
  return (
    <div className="min-h-screen p-6 bg-gray-100 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setScreen('menu')}
          className="mb-6 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg 
            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
            text-gray-800 dark:text-white"
        >
          ← Назад
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Правила игры ZERTZ
        </h1>
        
        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Цель игры
            </h2>
            <p>Первым захватить:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>4 белых шарика, ИЛИ</li>
              <li>5 серых шариков, ИЛИ</li>
              <li>6 чёрных шариков, ИЛИ</li>
              <li>3 шарика каждого цвета</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Ход игры
            </h2>
            <p className="mb-2">На каждом ходу игрок выполняет ОДНО из двух действий:</p>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-3">
              <h3 className="font-semibold mb-2">1. Размещение + удаление кольца</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>Выберите шарик любого цвета из резерва</li>
                <li>Поставьте его на любое пустое кольцо</li>
                <li>Удалите одно «свободное» кольцо с края доски</li>
              </ol>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">2. Взятие (обязательно!)</h3>
              <p>Если можете взять — ОБЯЗАНЫ взять!</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Прыгните через соседний шарик на пустое кольцо за ним</li>
                <li>Цвет не имеет значения</li>
                <li>Цепочки взятий — продолжайте пока возможно</li>
              </ul>
            </div>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Свободное кольцо
            </h2>
            <p>Кольцо можно удалить если:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>На нём нет шарика</li>
              <li>У него ≥2 свободных стороны (на краю)</li>
              <li>Удаление не разрывает доску</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Изоляция
            </h2>
            <p>
              Если группа колец отделяется от основной доски и все кольца заняты — 
              все шарики в группе автоматически захватываются текущим игроком!
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
