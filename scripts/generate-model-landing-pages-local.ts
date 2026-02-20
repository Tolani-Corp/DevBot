import fs from "fs/promises";
import path from "path";

const STUDIO_UPLOADS_DIR = "D:\\ingest\\Editor_vids\\Studio Uploads";
const OUTPUT_DIR = "C:\\Users\\terri\\Projects\\freakme.fun\\freakme_app\\app\\src\\pages\\models";

async function main() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const models = await fs.readdir(STUDIO_UPLOADS_DIR);
    
    for (const modelDir of models) {
      const modelPath = path.join(STUDIO_UPLOADS_DIR, modelDir);
      const stat = await fs.stat(modelPath);
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(modelPath);
        let modelName = modelDir;
        
        if (files.length > 0) {
          const firstFile = files[0];
          const nameWithoutExt = path.parse(firstFile).name;
          const cleanName = nameWithoutExt.replace(/\d+$/, '').trim();
          if (cleanName && cleanName.toLowerCase() !== modelDir.toLowerCase()) {
            modelName = cleanName;
          }
        }
        
        const componentName = modelDir.replace(/[^a-zA-Z0-9]/g, '');
        const fileName = `${componentName}.tsx`;
        const fullPath = path.join(OUTPUT_DIR, fileName);
        
        const content = `import React from 'react';
import { Star, Heart, PlayCircle, CheckCircle } from 'lucide-react';

export default function ${componentName}LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900 z-10" />
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <span className="text-gray-500 text-2xl">[ Hero Image Placeholder for ${modelName} ]</span>
        </div>
        <div className="relative z-20 text-center px-4">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-pink-500">${modelName}</h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">Exclusive Content & Behind the Scenes</p>
          <button className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors flex items-center mx-auto gap-2">
            <Star className="w-5 h-5" />
            Subscribe Now
          </button>
        </div>
      </div>

      {/* Stats/Features */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <PlayCircle className="w-10 h-10 text-pink-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">100+ Videos</h3>
            <p className="text-gray-400">High quality exclusive content</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <Heart className="w-10 h-10 text-pink-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Daily Updates</h3>
            <p className="text-gray-400">New content added every day</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <CheckCircle className="w-10 h-10 text-pink-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Direct Messaging</h3>
            <p className="text-gray-400">Chat directly with ${modelName}</p>
          </div>
        </div>
      </div>

      {/* Gallery Preview */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Latest Content</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 hover:border-pink-500 transition-colors cursor-pointer group relative overflow-hidden">
              <span className="text-gray-500">[ Image {i} ]</span>
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayCircle className="w-12 h-12 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-pink-900 to-purple-900 py-20 text-center px-4">
        <h2 className="text-4xl font-bold mb-6">Don't Miss Out</h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto text-pink-100">
          Join ${modelName}'s VIP club today and get instant access to all exclusive content, private streams, and more.
        </p>
        <button className="bg-white text-pink-900 hover:bg-gray-100 font-bold py-4 px-10 rounded-full text-xl transition-colors shadow-lg">
          Unlock All Content
        </button>
      </div>
    </div>
  );
}
`;
        
        await fs.writeFile(fullPath, content, "utf-8");
        console.log(`✅ Generated landing page for ${modelName} at ${fullPath}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
