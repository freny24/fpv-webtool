import { fromFile } from "geotiff";
import fs from "fs";

const KOPPEN = {1:'Af',2:'Am',3:'Aw',4:'BWh',5:'BWk',6:'BSh',7:'BSk',8:'Csa',9:'Csb',10:'Csc',11:'Cwa',12:'Cwb',13:'Cwc',14:'Cfa',15:'Cfb',16:'Cfc',17:'Dsa',18:'Dsb',19:'Dsc',20:'Dsd',21:'Dwa',22:'Dwb',23:'Dwc',24:'Dwd',25:'Dfa',26:'Dfb',27:'Dfc',28:'Dfd',29:'ET',30:'EF'};
const FIVE = {A_Tropical:'Tropical',B_Arid:'Arid',C_Temperate:'Temperate',D_Cold:'Cold',E_Polar:'Polar'};
const to5=(c)=>{c=Number(c); if(!c||c<=0)return null; if(c<=3)return'A_Tropical'; if(c<=7)return'B_Arid'; if(c<=16)return'C_Temperate'; if(c<=28)return'D_Cold'; return'E_Polar';};

const wb = JSON.parse(fs.readFileSync("/sessions/gifted-stoic-feynman/mnt/uploads/WB.geojson","utf8"));
const tiff = await fromFile("./data/koppen_beck.tif");
const img = await tiff.getImage();
const [ox,oy]=img.getOrigin(),[rx,ry]=img.getResolution(),W=img.getWidth(),H=img.getHeight();

const out={}; let sampled=0, hist={};
for (const f of wb.features){
  const p=f.properties||{};
  const id=p.wb_id!=null?String(p.wb_id):null;
  if(!id) continue;
  const lat=Number(p.lat), lon=Number(p.lon);
  let code=null;
  if(Number.isFinite(lat)&&Number.isFinite(lon)){
    let col=Math.min(Math.max(Math.floor((lon-ox)/rx),0),W-1);
    let row=Math.min(Math.max(Math.floor((lat-oy)/ry),0),H-1);
    const r=await img.readRasters({window:[col,row,col+1,row+1],interleave:true});
    code=Number(r[0]); sampled++;
  }
  const fc=to5(code); const zone=fc?FIVE[fc]:null;
  hist[zone||'Unknown']=(hist[zone||'Unknown']||0)+1;
  out[id]={
    wb_new_id:id,
    lake_name:p.lake_name??null,
    country:p.country??null, state:p.state??null, city:p.city??null,
    fpv_cov:p.aqpv_coverage_pct??null,
    wb_area:p.wb_area_km2??null,
    n_fpv:p.n_installations??null,
    water_type:p.base_water_body_classification??null,
    functional_use:p.functional_use_classification??null,
    lat:Number.isFinite(lat)?lat:null, lon:Number.isFinite(lon)?lon:null,
    koppen_code: code&&code>0?code:null,
    koppen_label: KOPPEN[code]??null,
    koppen_5class: fc,
    climate_zone: zone,
  };
}
fs.writeFileSync("./data/wb_cache.json", JSON.stringify(out));
console.log("wrote", Object.keys(out).length, "records; sampled", sampled);
console.log("climate histogram:", hist);
